import torch
import numpy as np
from scipy.stats import pearsonr
from bioflow.utils.inference_utils import constrained_inference


def metric_func(preds_all: np.ndarray, y_test: np.ndarray, genes: list):
    errors = []
    r2_scores = []
    pearson_corrs = []
    pearson_genes = []
    
    n_nan_genes = 0
    for i, target in enumerate(range(y_test.shape[1])):
        preds = preds_all[:, target]
        target_vals = y_test[:, target]

        errors.append(float(np.mean((preds - target_vals) ** 2)))
        r2_scores.append(float(1 - np.sum((target_vals - preds) ** 2) / np.sum((target_vals - np.mean(target_vals)) ** 2)))
        pearson_corr, _ = pearsonr(target_vals, preds)
        pearson_corrs.append(pearson_corr)

        if np.isnan(pearson_corr):
            n_nan_genes += 1

        score_dict = {
            'name': genes[i],
            'pearson_corr': pearson_corr,
        }
        pearson_genes.append(score_dict)

    if n_nan_genes > 0:
        print(f"Warning: {n_nan_genes} genes have NaN Pearson correlation")

    return {'l2_errors': list(errors), 
            'r2_scores': list(r2_scores),
            'pearson_corrs': pearson_genes,
            'pearson_mean': float(np.mean(pearson_corrs)),
            'pearson_std': float(np.std(pearson_corrs)),
            'l2_error_q1': float(np.percentile(errors, 25)),
            'l2_error_q2': float(np.median(errors)),
            'l2_error_q3': float(np.percentile(errors, 75)),
            'r2_score_q1': float(np.percentile(r2_scores, 25)),
            'r2_score_q2': float(np.median(r2_scores)),
            'r2_score_q3': float(np.percentile(r2_scores, 75))
        }


@torch.no_grad()
def test(args, diffusier, model, loader_list, return_all=False):
    model.eval()
    all_pred, all_gt = [], []
    res_dict = {}

    for loader in loader_list:
        cur_pred, cur_gt = [], []

        for step, batch in enumerate(loader):
            batch = [x.to(args.device) for x in batch]
            img_features, coords, labels = batch
            assert img_features.shape[0] == 1, "Batch size must be 1 for inference"

            if args.use_non_negative_constraint:
                sample = constrained_inference(
                    model=model,
                    diffusier=diffusier,
                    img_features=img_features,
                    coords=coords,
                    args=args,
                    use_non_negative=True
                )
            else:
                exp_t1 = diffusier.sample_from_prior(labels.shape).to(args.device)
                S = args.n_sample_steps
                dt = 1.0 / S
                for s in range(S):
                    t_val = float(s) / S
                    t_tensor = torch.full((exp_t1.shape[0],), t_val, device=args.device)
                    v_pred = model.inference(
                        exp_t1, img_features, coords,
                        t_tensor, predict=True
                    )
                    exp_t1 = exp_t1 + dt * v_pred
                sample = exp_t1
            cur_pred.append(sample.squeeze(0).cpu().numpy())
            cur_gt.append(labels.squeeze(0).cpu().numpy())
        
        # test the performance on each dataset
        cur_pred = np.concatenate(cur_pred, axis=0)
        cur_gt = np.concatenate(cur_gt, axis=0)
        cur_res_dict = metric_func(cur_pred, cur_gt, loader.dataset.gene_list)        
        cur_res_dict.update({'n_test': len(cur_gt)})
        res_dict[loader.dataset.name] = cur_res_dict

        all_pred.append(cur_pred)
        all_gt.append(cur_gt)
    
    # test the performance on all datasets
    all_pred = np.concatenate(all_pred, axis=0)
    all_gt = np.concatenate(all_gt, axis=0)
    cur_res_dict = metric_func(all_pred, all_gt, loader_list[0].dataset.gene_list)
    cur_res_dict.update({'n_test': len(all_gt)})
    res_dict["all"] = cur_res_dict
    if return_all:
        return res_dict, {'preds_all': all_pred, 'targets_all': all_gt}
    return res_dict
