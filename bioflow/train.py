import os
import sys
import json
import wandb
import argparse
import numpy as np
import pandas as pd
from time import time
from tqdm import tqdm
from operator import itemgetter

import torch
import torch.nn.functional as F

# Add project root to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from bioflow.utils import set_random_seed, get_current_time, merge_fold_results
from bioflow.data.dataset import HESTDatasetPath, MultiHESTDataset, padding_batcher, HESTDataset
from bioflow.data.normalize_utils import get_normalize_method
from bioflow.model.vpredictor import MMDiTDenoiser
from bioflow.flow.interpolant import Interpolant
from bioflow.test import test

def json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    return str(o)


def calculate_gene_expression_stats(preds_all: np.ndarray, targets_all: np.ndarray, gene_list: list):
    """
    Calculate expression statistics for each gene in predictions and targets.
    
    Args:
        preds_all: Prediction array (n_samples, n_genes)
        targets_all: Target array (n_samples, n_genes)
        gene_list: List of gene names
    
    Returns:
        dict: Dictionary containing statistics for each gene and overall summary
    """
    gene_stats = {}
    for i, gene_name in enumerate(gene_list):
        pred_values = preds_all[:, i]
        target_values = targets_all[:, i]
        
        gene_stats[gene_name] = {
            'predicted': {
                'min': float(np.min(pred_values)),
                'max': float(np.max(pred_values)),
                'mean': float(np.mean(pred_values)),
                'std': float(np.std(pred_values))
            },
            'ground_truth': {
                'min': float(np.min(target_values)),
                'max': float(np.max(target_values)),
                'mean': float(np.mean(target_values)),
                'std': float(np.std(target_values))
            }
        }
    
    all_pred_values = preds_all.flatten()
    all_target_values = targets_all.flatten()
    
    summary_stats = {
        'overall_summary': {
            'predicted': {
                'min': float(np.min(all_pred_values)),
                'max': float(np.max(all_pred_values)),
                'mean': float(np.mean(all_pred_values)),
                'std': float(np.std(all_pred_values)),
                'median': float(np.median(all_pred_values))
            },
            'ground_truth': {
                'min': float(np.min(all_target_values)),
                'max': float(np.max(all_target_values)),
                'mean': float(np.mean(all_target_values)),
                'std': float(np.std(all_target_values)),
                'median': float(np.median(all_target_values))
            }
        },
        'dataset_info': {
            'n_samples': int(preds_all.shape[0]),
            'n_genes': int(preds_all.shape[1]),
            'gene_list': gene_list
        }
    }
    
    gene_stats['summary'] = summary_stats
    
    return gene_stats


def main(args, split_id, train_sample_ids, test_sample_ids, val_save_dir, checkpoint_save_dir):
    normalize_method = get_normalize_method(args.normalize_method)

    print("Dataset Loading")
    sample_id_paths = [
        HESTDatasetPath(
            name=sample_id,
            h5_path=os.path.join(args.embed_dataroot, args.dataset, args.feature_encoder, f"fp32/{sample_id}.h5"),
            h5ad_path=os.path.join(args.source_dataroot, args.dataset, f"adata/{sample_id}.h5ad"),
            gene_list_path=os.path.join(args.source_dataroot, args.dataset, args.gene_list),
        ) for sample_id in train_sample_ids
    ]
    train_dataset = MultiHESTDataset(sample_id_paths, 
                                     distribution=args.patch_distribution, 
                                     normalize_method=normalize_method,
                                     sample_times=args.sample_times)
    train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=args.batch_size, collate_fn=padding_batcher())

    val_sample_id_paths = [
        HESTDatasetPath(
                name=sample_id,
                h5_path=os.path.join(args.embed_dataroot, args.dataset, args.feature_encoder, f"fp32/{sample_id}.h5"),
                h5ad_path=os.path.join(args.source_dataroot, args.dataset, f"adata/{sample_id}.h5ad"),
                gene_list_path=os.path.join(args.source_dataroot, args.dataset, args.gene_list
            ),
        ) for sample_id in train_sample_ids
    ]
    val_loaders = [
        torch.utils.data.DataLoader(
            HESTDataset(
                sample_id_path, distribution="constant_1.0", 
                normalize_method=normalize_method,
                sample_times=1
            ),
            batch_size=1, collate_fn=padding_batcher()
        ) for sample_id_path in val_sample_id_paths
    ]
    
    test_sample_id_paths = [
        HESTDatasetPath(
                name=sample_id,
                h5_path=os.path.join(args.embed_dataroot, args.dataset, args.feature_encoder, f"fp32/{sample_id}.h5"),
                h5ad_path=os.path.join(args.source_dataroot, args.dataset, f"adata/{sample_id}.h5ad"),
                gene_list_path=os.path.join(args.source_dataroot, args.dataset, args.gene_list
            ),
        ) for sample_id in test_sample_ids
    ]
    test_loaders = [
        torch.utils.data.DataLoader(
            HESTDataset(
                sample_id_path, distribution="constant_1.0", 
                normalize_method=normalize_method,
                sample_times=1
            ),
            batch_size=1, collate_fn=padding_batcher()
        ) for sample_id_path in test_sample_id_paths
    ]

    device = args.device
    model = MMDiTDenoiser(args).to(device)

    diffusier = Interpolant(
        args.prior_sampler, 
        device=device,
        total_count=torch.tensor([args.zinb_total_count], device=device),
        logits=torch.tensor([args.zinb_logits], device=device),
        zi_logits=args.zinb_zi_logits,
        normalize=args.prior_sampler != "gaussian",
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    print("Training")
    best_pearson, best_val_dict = -1, None
    early_stop_step = 0
    epoch_iter = tqdm(range(1, args.epochs + 1), ncols=100)
    for epoch in epoch_iter:
        avg_loss = 0
        model.train()

        for step, batch in enumerate(train_loader):
            batch = [x.to(device) for x in batch]
            img_features, coords, gene_exp = batch

            noisy_exp, exp0, t_steps = diffusier.corrupt_exp(gene_exp)
            
            v_pred = model.inference(
                noisy_exp,
                img_features,
                coords,
                t_steps,
                predict=True
            )
            
            pad_mask = img_features.sum(-1) == 0
            v_true = diffusier.get_target_velocity(gene_exp, exp0, t_steps)
            
            v_pred = - noisy_exp / (1 - diffusier.alpha(t_steps)[:, None, None] + 1e-8) + F.softplus(v_pred)
            mse_loss = model.loss_func(v_pred[~pad_mask], v_true[~pad_mask])
            loss = mse_loss

            optimizer.zero_grad()
            model.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), args.clip_norm)
            optimizer.step()

            if args.use_wandb:
                log_dict = {f"{args.dataset}/Train/{split_id}/loss": loss.cpu().item()}
                wandb.log(log_dict)

            avg_loss += loss.cpu().item()
        
        avg_loss /= len(train_loader)
        epoch_iter.set_description(f"epoch: {epoch}, avg_loss: {avg_loss:.3f}")

        if args.save_step > 0 and epoch % args.save_step == 0:
            torch.save(model.state_dict(), os.path.join(checkpoint_save_dir, f"{epoch}.pth"))

        if epoch % args.eval_step == 0 or epoch == args.epochs:
            val_perf_dict, pred_dump = test(args, diffusier, model, val_loaders, return_all=True)
            if val_perf_dict["all"]['pearson_mean'] > best_pearson:
                best_pearson = val_perf_dict["all"]['pearson_mean']
                best_val_dict = val_perf_dict
                for patch_name, dataset_res in val_perf_dict.items():
                    with open(os.path.join(val_save_dir, f'{patch_name}_results.json'), 'w') as f:
                        json.dump(dataset_res, f, sort_keys=True, indent=4, default=json_default)
                
                gene_stats = calculate_gene_expression_stats(
                    pred_dump['preds_all'], 
                    pred_dump['targets_all'], 
                    val_loaders[0].dataset.gene_list
                )
                stats_file_path = os.path.join(val_save_dir, 'gene_expression_stats.json')
                with open(stats_file_path, 'w') as f:
                    json.dump(gene_stats, f, sort_keys=True, indent=4, default=json_default)
                
                print(f"Saved gene expression statistics to: {stats_file_path}")
                print(f"Contains detailed statistics for {len(val_loaders[0].dataset.gene_list)} genes")
                best_pcc_data = {
                    'predictions': pred_dump['preds_all'],
                    'targets': pred_dump['targets_all'],
                    'gene_list': val_loaders[0].dataset.gene_list,
                    'pearson_correlation': best_pearson,
                    'epoch': epoch
                }
                best_pcc_file = os.path.join(val_save_dir, 'best_pcc_data.npz')
                np.savez(best_pcc_file, **best_pcc_data)
                
                try:
                    preds_all_np = pred_dump['preds_all']
                    targets_all_np = pred_dump['targets_all']

                    mse_overall = float(np.mean((preds_all_np - targets_all_np) ** 2))
                    mae_overall = float(np.mean(np.abs(preds_all_np - targets_all_np)))

                    pearson_items = val_perf_dict["all"].get('pearson_corrs', [])
                    pearson_values = [x.get('pearson_corr', None) for x in pearson_items]
                    pearson_values = [x for x in pearson_values if x is not None and not np.isnan(x)]
                    pearson_values.sort(reverse=True)

                    def _top_mean(values, k):
                        if len(values) == 0:
                            return float('nan')
                        return float(np.mean(values[:min(k, len(values))]))

                    pcc20_mean = _top_mean(pearson_values, 20)
                    pcc50_mean = _top_mean(pearson_values, 50)

                    csv_path = os.path.join(val_save_dir, 'best_metrics.csv')
                    import csv
                    with open(csv_path, 'w', newline='') as f_csv:
                        writer = csv.writer(f_csv)
                        writer.writerow(['epoch', 'pearson_mean', 'mse', 'mae', 'pcc20', 'pcc50'])
                        writer.writerow([
                            epoch,
                            f"{best_pearson:.6f}",
                            f"{mse_overall:.6f}",
                            f"{mae_overall:.6f}",
                            f"{pcc20_mean:.6f}",
                            f"{pcc50_mean:.6f}",
                        ])

                    print(f"Saved best metrics to CSV: {csv_path}")
                except Exception as e:
                    print(f"Error saving best metrics CSV: {e}")

                print(f"Saved best PCC data to: {best_pcc_file}")
                print(f"Current best PCC: {best_pearson:.4f} (Epoch {epoch})")
                
                early_stop_step = 0

            else:
                early_stop_step += 1
                if early_stop_step >= 20:
                    print("Early stopping")
                    print("Saving test set predictions on early stop...")
                    test_perf_dict, test_pred_dump = test(args, diffusier, model, test_loaders, return_all=True)
                    test_predictions_file = os.path.join(val_save_dir, 'test_predictions_early_stop.npz')
                    test_predictions_data = {
                        'predictions': test_pred_dump['preds_all'],
                        'targets': test_pred_dump['targets_all'],
                        'gene_list': test_loaders[0].dataset.gene_list,
                        'pearson_correlation': test_perf_dict["all"]['pearson_mean'],
                        'epoch': epoch
                    }
                    np.savez(test_predictions_file, **test_predictions_data)
                    print(f"Saved test predictions to: {test_predictions_file}")
                    break

            print(f"Epoch {epoch} - Evaluating on test set...")
            test_perf_dict, test_pred_dump = test(args, diffusier, model, test_loaders, return_all=True)
            test_pearson = test_perf_dict["all"]['pearson_mean']
            test_pcc10 = float('nan')
            test_pcc20 = float('nan')
            try:
                test_pearson_items = test_perf_dict["all"].get('pearson_corrs', [])
                test_pearson_values = [x.get('pearson_corr', None) for x in test_pearson_items]
                test_pearson_values = [x for x in test_pearson_values if x is not None and not np.isnan(x)]
                test_pearson_values.sort(reverse=True)

                def _top_mean(values, k):
                    if len(values) == 0:
                        return float('nan')
                    return float(np.mean(values[:min(k, len(values))]))

                test_pcc10 = _top_mean(test_pearson_values, 10)
                test_pcc20 = _top_mean(test_pearson_values, 20)
                
                test_csv_path = os.path.join(val_save_dir, 'test_metrics.csv')
                import csv
                file_exists = os.path.exists(test_csv_path)
                with open(test_csv_path, 'a', newline='') as f_csv:
                    writer = csv.writer(f_csv)
                    if not file_exists:
                        writer.writerow(['epoch', 'pearson_mean', 'pcc10', 'pcc20'])
                    writer.writerow([
                        epoch,
                        f"{test_pearson:.6f}",
                        f"{test_pcc10:.6f}",
                        f"{test_pcc20:.6f}",
                    ])
                
                print(f"Test set Epoch {epoch} - PCC: {test_pearson:.4f}, PCC-10: {test_pcc10:.4f}, PCC-20: {test_pcc20:.4f}")
            except Exception as e:
                print(f"Error calculating test PCC metrics: {e}")

            if args.use_wandb:
                for patch_name, dataset_res in val_perf_dict.items():
                    wandb.log({
                        f"{args.dataset}/Val/{split_id}/{patch_name}/pearson_mean": dataset_res['pearson_mean'],
                        f"{args.dataset}/Val/{split_id}/{patch_name}/pearson_std": dataset_res['pearson_std'],
                        f"{args.dataset}/Val/{split_id}/{patch_name}/l2_error_q1": dataset_res['l2_error_q1'],
                        f"{args.dataset}/Val/{split_id}/{patch_name}/l2_error_q2": dataset_res['l2_error_q2'],
                        f"{args.dataset}/Val/{split_id}/{patch_name}/l2_error_q3": dataset_res['l2_error_q3'],
                        f"{args.dataset}/Val/{split_id}/{patch_name}/r2_score_q1": dataset_res['r2_score_q1'],
                        f"{args.dataset}/Val/{split_id}/{patch_name}/r2_score_q2": dataset_res['r2_score_q2'],
                        f"{args.dataset}/Val/{split_id}/{patch_name}/r2_score_q3": dataset_res['r2_score_q3'],
                    })
                
                wandb.log({
                    f"{args.dataset}/Test/{split_id}/pearson_mean": test_pearson,
                    f"{args.dataset}/Test/{split_id}/pcc10": test_pcc10,
                    f"{args.dataset}/Test/{split_id}/pcc20": test_pcc20,
                })

    test_final_results = {'pearson_mean': float('nan'), 'pcc10': float('nan'), 'pcc20': float('nan')}
    test_csv_path = os.path.join(val_save_dir, 'test_metrics.csv')
    if os.path.exists(test_csv_path):
        try:
            import csv
            with open(test_csv_path, 'r') as f_csv:
                reader = csv.reader(f_csv)
                rows = list(reader)
                if len(rows) > 1:
                    last_row = rows[-1]
                    if len(last_row) >= 4:
                        test_final_results['pearson_mean'] = float(last_row[1])
                        test_final_results['pcc10'] = float(last_row[2])
                        test_final_results['pcc20'] = float(last_row[3])
                        print(f"Test set final results - PCC: {test_final_results['pearson_mean']:.4f}, "
                              f"PCC-10: {test_final_results['pcc10']:.4f}, "
                              f"PCC-20: {test_final_results['pcc20']:.4f}")
        except Exception as e:
            print(f"Error reading test final results: {e}")

    return {
        'val': best_val_dict["all"],
        'test': test_final_results
    }


def run(args):
    split_dir = os.path.join(args.source_dataroot, args.dataset, 'splits')
    splits = os.listdir(split_dir)
    all_split_results = []
    all_test_results = []
    
    for i in range(len(splits) // 2):
        print(f"Running dataset {args.dataset} split {i}")

        train_df = pd.read_csv(os.path.join(split_dir, f'train_{i}.csv'))
        test_df = pd.read_csv(os.path.join(split_dir, f'test_{i}.csv'))

        train_sample_ids = train_df['sample_id'].tolist()
        test_sample_ids = test_df['sample_id'].tolist()

        kfold_save_dir = os.path.join(args.save_dir, f'split{i}')
        os.makedirs(kfold_save_dir, exist_ok=True)
        checkpoint_save_dir = os.path.join(kfold_save_dir, 'checkpoints')
        os.makedirs(checkpoint_save_dir, exist_ok=True)

        results = main(args, i, train_sample_ids, test_sample_ids, kfold_save_dir, checkpoint_save_dir)
        all_split_results.append(results['val'])
        all_test_results.append({
            'split_id': i,
            'pearson_mean': results['test']['pearson_mean'],
            'pcc10': results['test']['pcc10'],
            'pcc20': results['test']['pcc20']
        })

    kfold_results = merge_fold_results(all_split_results)
    with open(os.path.join(args.save_dir, f'results_kfold.json'), 'w') as f:
        p_corrs = kfold_results['pearson_corrs']
        p_corrs = sorted(p_corrs, key=itemgetter('mean'), reverse=True)
        kfold_results['pearson_corrs'] = p_corrs
        json.dump(kfold_results, f, sort_keys=True, indent=4, default=json_default)
    
    test_results_csv_path = os.path.join(args.save_dir, 'test_results_all_splits.csv')
    import csv
    with open(test_results_csv_path, 'w', newline='') as f_csv:
        writer = csv.writer(f_csv)
        writer.writerow(['split_id', 'pearson_mean', 'pcc10', 'pcc20'])
        
        valid_results = [r for r in all_test_results if not np.isnan(r['pearson_mean'])]
        if len(valid_results) > 0:
            avg_pearson = np.mean([r['pearson_mean'] for r in valid_results])
            avg_pcc10 = np.mean([r['pcc10'] for r in valid_results if not np.isnan(r['pcc10'])])
            avg_pcc20 = np.mean([r['pcc20'] for r in valid_results if not np.isnan(r['pcc20'])])
        else:
            avg_pearson = float('nan')
            avg_pcc10 = float('nan')
            avg_pcc20 = float('nan')
        
        for result in all_test_results:
            writer.writerow([
                result['split_id'],
                f"{result['pearson_mean']:.6f}",
                f"{result['pcc10']:.6f}",
                f"{result['pcc20']:.6f}",
            ])
        
        writer.writerow([
            'mean',
            f"{avg_pearson:.6f}",
            f"{avg_pcc10:.6f}",
            f"{avg_pcc20:.6f}",
        ])
    
    print(f"\nTest results for all splits saved to: {test_results_csv_path}")
    print(f"Average results - PCC: {avg_pearson:.4f}, PCC-10: {avg_pcc10:.4f}, PCC-20: {avg_pcc20:.4f}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', type=int, default=1)
    parser.add_argument('--datasets', nargs='+', required=True, help=["her2st", "READ", "PRAD"])
    parser.add_argument('--use_wandb', default=True)
    parser.add_argument('--source_dataroot', default="/nfs/xhr/xhr/dataset")
    parser.add_argument('--embed_dataroot', type=str, default="/nfs/xhr/xhr/dataset/embed_dataroot")
    parser.add_argument('--gene_list', type=str, default='hmhvg_50genes.json',help='hmhvg_50genes.json')
    parser.add_argument('--save_dir', type=str, default="results_dir/")
    parser.add_argument('--feature_encoder', type=str, default='uni_v1_official', help="uni_v1_official | conch_v1 | ciga | gigapath")
    parser.add_argument('--normalize_method', type=str, default="log1p")
    parser.add_argument('--exp_code', type=str, default="test")
    
    # training hyperparameters
    parser.add_argument('--device', type=int, default=0)
    parser.add_argument('--sample_times', type=int, default=5, help='Number of times to sample patches from each image')
    parser.add_argument('--batch_size', type=int, default=2, help='Batch size')
    parser.add_argument('--lr', type=float, default=5e-4)
    parser.add_argument('--epochs', type=int, default=500)
    parser.add_argument('--clip_norm', type=float, default=1.)
    parser.add_argument('--save_step', type=int, default=-1)
    parser.add_argument('--eval_step', type=int, default=1)
    parser.add_argument('--num_workers', type=int, default=1, help='Number of workers for dataloader')
    parser.add_argument('--loss_func', type=str, default='mse', help="mse | mae | pearson")
    parser.add_argument('--patch_distribution', type=str, default='uniform')
    parser.add_argument('--n_genes', type=int, default=50)
    
    # biological validity constraints
    parser.add_argument('--use_non_negative_constraint', action='store_true', default=True, help="Use non-negative constraint for biological validity")

    # flow matching hyperparameters
    parser.add_argument('--n_sample_steps', type=int, default=10)
    parser.add_argument('--prior_sampler', type=str, default="gaussian", help="gaussian | uniform | zero | zinb")
    parser.add_argument('--zinb_logits', type=float, default=0.1)
    parser.add_argument('--zinb_total_count', type=float, default=1)
    parser.add_argument('--zinb_zi_logits', type=float, default=0., help="Prob for zero inflation")  # before sigmoid

    # model hyperparameters
    parser.add_argument('--backbone', type=str, default="spatial_transformer")
    parser.add_argument('--hidden_dim', type=int, default=128)
    parser.add_argument('--pairwise_hidden_dim', type=int, default=128)
    parser.add_argument('--n_layers', type=int, default=4)
    parser.add_argument('--dropout', type=float, default=0.2)
    parser.add_argument('--attn_dropout', type=float, default=0.2)
    parser.add_argument('--n_neighbors', type=int, default=8)
    parser.add_argument('--n_heads', type=int, default=4)
    parser.add_argument('--feature_dim', type=int, default=1024, help="uni:1024")
    parser.add_argument('--norm', type=str, default='layer', help="batch | layer")
    parser.add_argument('--activation', type=str, default='swiglu', help="relu | gelu | swiglu")
    
    args = parser.parse_args()

    args.feature_dim = {
        "uni_v1_official": 1024,
        "gigapath": 1536,
        "ciga": 512,
    }[args.feature_encoder]

    set_random_seed(args.seed)

    exp_code = f"test_{get_current_time()}"
    save_dir = os.path.join(args.save_dir, exp_code)
    os.makedirs(save_dir, exist_ok=True)
    
    if args.use_wandb:
        wandb.init(project="spatial_transcriptomics", name=exp_code)
        wandb.config.update(args)

    print(f"Save dir: {save_dir}")
    print(args)

    if args.datasets[0] == "all":
        args.datasets = ["her2st","PRAD","READ"]
    dataset_training_times = []
    training_times_csv_path = os.path.join(save_dir, 'dataset_training_times.csv')
    
    for dataset in args.datasets:
        args.dataset = dataset
        args.save_dir = os.path.join(save_dir, dataset)
        os.makedirs(args.save_dir, exist_ok=True)

        with open(os.path.join(args.save_dir, 'config.json'), 'w') as f:
            json.dump(vars(args), f, sort_keys=True, indent=4, default=json_default)

        training_start_time = time()
        training_start_time_str = get_current_time()
        print(f"\n{'='*80}")
        print(f"Training dataset: {dataset}")
        print(f"Start time: {training_start_time_str}")
        print(f"{'='*80}\n")
        
        run(args)
        
        training_end_time = time()
        training_end_time_str = get_current_time()
        training_duration = training_end_time - training_start_time
        training_hours = int(training_duration // 3600)
        training_minutes = int((training_duration % 3600) // 60)
        training_seconds = int(training_duration % 60)
        
        time_info = {
            'dataset': dataset,
            'start_time': training_start_time_str,
            'end_time': training_end_time_str,
            'duration_seconds': training_duration,
            'duration_hours': training_hours,
            'duration_minutes': training_minutes,
            'duration_seconds_remainder': training_seconds,
            'duration_formatted': f"{training_hours:02d}:{training_minutes:02d}:{training_seconds:02d}"
        }
        
        dataset_training_times.append(time_info)
        
        dataset_time_json_path = os.path.join(args.save_dir, 'training_time.json')
        with open(dataset_time_json_path, 'w') as f:
            json.dump(time_info, f, sort_keys=True, indent=4, default=json_default)
        print(f"Saved training time for dataset {dataset} to: {dataset_time_json_path}")
        
        import csv
        file_exists = os.path.exists(training_times_csv_path)
        with open(training_times_csv_path, 'a', newline='') as f_csv:
            writer = csv.writer(f_csv)
            if not file_exists:
                writer.writerow(['dataset', 'duration_seconds', 'duration_formatted', 'start_time', 'end_time'])
            writer.writerow([
                time_info['dataset'],
                f"{time_info['duration_seconds']:.2f}",
                time_info['duration_formatted'],
                time_info['start_time'],
                time_info['end_time']
            ])
        print(f"Appended training time for dataset {dataset} to CSV: {training_times_csv_path}")
        
        print(f"\n{'='*80}")
        print(f"Dataset {dataset} training completed")
        print(f"Training time: {training_hours:02d}:{training_minutes:02d}:{training_seconds:02d} ({training_duration:.2f} seconds)")
        print(f"End time: {training_end_time_str}")
        print(f"{'='*80}\n")

    total_duration = sum([t['duration_seconds'] for t in dataset_training_times])
    total_hours = int(total_duration // 3600)
    total_minutes = int((total_duration % 3600) // 60)
    total_seconds = int(total_duration % 60)
    
    import csv
    with open(training_times_csv_path, 'a', newline='') as f_csv:
        writer = csv.writer(f_csv)
        writer.writerow([
            'total',
            f"{total_duration:.2f}",
            f"{total_hours:02d}:{total_minutes:02d}:{total_seconds:02d}",
            '',
            ''
        ])
    
    print(f"\nTraining times for all datasets saved to: {training_times_csv_path}")
    print(f"Total training time: {total_hours:02d}:{total_minutes:02d}:{total_seconds:02d} ({total_duration:.2f} seconds)")

    if args.use_wandb:
        wandb.finish()
