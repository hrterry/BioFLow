# BioFlow

**A Biologically Valid Support-Preserving Flow for Histology-Conditioned Spatial Transcriptomics Prediction**

[Project Page](https://hrterry.github.io/BioFLow/) · [MICCAI Open Access Paper](https://papers.miccai.org/miccai-2026/0109-Paper1400.html) · [Source Code](https://github.com/hrterry/BioFLow)

BioFlow predicts spatial gene expression from routine H&E histology while preserving a fundamental biological constraint throughout generation: expression values must remain non-negative. This repository contains the PyTorch implementation and the interactive MICCAI 2026 project page.

## Motivation

Standard diffusion and flow-matching models evolve in an unconstrained real-valued space. Even when their final predictions are clipped, intermediate trajectories may enter negative-expression regions that are biologically invalid. BioFlow modifies the learned velocity field itself so that the complete probability path remains inside the non-negative orthant.

## Highlights

- **Support-preserving dynamics** — non-negativity is enforced during transport rather than repaired after sampling.
- **Histology-conditioned prediction** — multimodal spatial modeling combines pathology-image features with tissue coordinates.
- **Sparse-expression stability** — boundary-aware updates remain valid for genes initialized exactly at zero.
- **Efficient generation** — the paper reports competitive prediction quality with substantially fewer sampling steps than diffusion-based alternatives.
- **Interactive evidence** — the [project page](https://hrterry.github.io/BioFLow/) presents the method, trajectory diagnostics, spatial predictions, and efficiency results as a scroll-driven research narrative.

## Repository Structure

```text
BioFLow/
├── bioflow/
│   ├── data/            # datasets, normalization, distributions, and sampling
│   ├── flow/            # interpolant and prior definitions
│   ├── model/           # spatial velocity predictor and configuration
│   ├── utils/           # training and inference utilities
│   ├── train.py         # training and cross-validation entry point
│   ├── test.py          # evaluation metrics and sampling
│   └── BioFlow.yml      # Conda environment
├── assets/              # project-page figures
└── index.html           # static GitHub Pages site
```

## Installation

```bash
git clone https://github.com/hrterry/BioFLow.git
cd BioFLow

conda env create -n bioflow -f bioflow/BioFlow.yml
conda activate bioflow
```

The environment covers BioFlow and the included baseline integrations. External pathology encoders and dataset-construction utilities—such as UNI, CONCH, and HEST—should be installed from their official repositories.

## Data and Feature Preparation

BioFlow expects HEST-compatible spatial-transcriptomics data and precomputed histology embeddings. The experiments use PRAD, READ, and HER2ST cohorts with UNI or CONCH image features.

```bash
pip install huggingface_hub
huggingface-cli login

huggingface-cli download MahmoodLab/UNI --local-dir models/uni
huggingface-cli download MahmoodLab/CONCH --local-dir models/conch
```

Access to both encoders requires accepting their respective Hugging Face terms: [UNI](https://huggingface.co/MahmoodLab/UNI) and [CONCH](https://huggingface.co/MahmoodLab/CONCH).

## Training

Provide the raw dataset root, precomputed embedding root, and gene-list JSON used by your experiment:

```bash
python -m bioflow.train \
  --datasets PRAD READ her2st \
  --source_dataroot /path/to/datasets \
  --embed_dataroot /path/to/embeddings \
  --gene_list /path/to/hmhvg_50genes.json \
  --feature_encoder uni_v1_official \
  --save_dir results/bioflow \
  --exp_code bioflow_main
```

Important options include `--n_sample_steps`, `--prior_sampler`, `--normalize_method`, `--n_neighbors`, and `--feature_encoder`. See `python -m bioflow.train --help` for the complete configuration.

## Evaluation

Evaluation is performed during training and through the utilities in `bioflow/test.py`. Reported metrics include mean Pearson correlation, per-gene Pearson correlation, mean-squared error, and R². Inference uses the support-preserving update when `use_non_negative_constraint` is enabled.

## Project Status

- Interactive project page: available
- MICCAI Open Access paper: available
- Training and evaluation code: available
- Pretrained BioFlow weights: planned
- Inference notebook and lightweight demo: planned

## Citation

If you use BioFlow, please cite the MICCAI 2026 paper:

```bibtex
@InProceedings{XuHao_BioFlow_MICCAI2026,
  author    = {Xu, Haoran and Liu, Yang and Yuan, Wei and Han, Xiao},
  title     = {BioFlow: A Biologically Valid Support-Preserving Flow for Histology-Conditioned Spatial Transcriptomics Prediction},
  booktitle = {Medical Image Computing and Computer Assisted Intervention -- MICCAI 2026},
  year      = {2026},
  publisher = {Springer Nature Switzerland},
  volume    = {LNCS 16891},
  month     = {September},
  pages     = {pending}
}
```

## License

Please refer to the repository license and the licenses of external datasets and feature encoders before redistributing code, weights, or derived data.
