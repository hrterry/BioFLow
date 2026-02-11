# BioFLow
Official PyTorch implementation of the BioFlow: Biologically Valid Generative Flow for Histology-Conditioned Spatial Transcriptomics Prediction. Released as part of an anonymous CVPR submission.

> ⚠️ This codebase is released as part of an **anonymous submission**.  
> All identifying information has been removed to comply with the double-blind 
> review policy.

---

## Overview

Spatial transcriptomics (ST) prediction from histology images is typically approached
using generative models (e.g., diffusion or standard 
flow matching). However, these methods suffer from a critical biological failure mode:
their generative trajectories evolve in unconstrained real-valued space, often 
producing **negative gene expression values**, which are biologically invalid.

**BioFlow** addresses this issue by enforcing *non-negative support preservation*
throughout the entire generative trajectory while maintaining efficient and expressive
multimodal conditioning.

---

## Key Features

- **Support-preserving flow dynamics**  
  A reparameterized velocity field guarantees non-negative expression throughout the 
  probability path.

- **Efficiency frontier**  
  Achieves state-of-the-art accuracy while requiring **4–100× less compute** than flow-based 
  baselines and up to **10,000×** less compute than diffusion-based models.

---
## 🔥🔥🔥 Update(Dec. 2025)

We have launched a project webpage that includes visualization of prediction results for three marker genes across different methods, facilitating comparison with ground truth values, as well as the proportion of negative values.

> **Note:** Due to space limitations, figures that could not be included in the paper are available on the project webpage for viewing.
---

## Environment Setup

The provided conda environment is fully compatible with BioFlow and all baseline 
models (STFlow, MERGE, TRIPLEX, and STEM), ensuring a unified and reproducible 
experimental setup. Note that external feature extractors (UNI, CONCH) and 
preprocessing utilities used in prior work (e.g., HEST for dataset construction) 
are not included in this repository and should be installed separately by cloning 
their respective GitHub repositories.

```bash

conda env create -n bioflow -f BioFlow.yml
conda activate bioflow

```

---

## Data & Model Preparation

### Download Pre-trained Models

We require pre-trained feature extractors: UNI and CONCH. To download all models at once:

```bash
pip install huggingface_hub
# Login to Hugging Face (required for UNI and CONCH access)
huggingface-cli login

# Download UNI model
hf download MahmoodLab/UNI --local-dir models/uni

# Download CONCH model
hf download MahmoodLab/CONCH --local-dir models/conch
```



**Note:** Both UNI and CONCH models require authentication and agreement to terms of use. Please visit [MahmoodLab/UNI](https://huggingface.co/MahmoodLab/UNI) and [MahmoodLab/CONCH](https://huggingface.co/MahmoodLab/CONCH) to request access. 

### Prepare Datasets

```bash
datasets_to_download = ["PRAD", "READ", "her2st"]
loaded = {name: load_dataset("MahmoodLab/hest", name) for name in datasets_to_download}
```