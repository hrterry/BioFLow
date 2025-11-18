# BioFLow
Official implementation of the BioFlow: Biologically Valid Generative Flow for Histology-Conditioned Spatial Transcriptomics Prediction. Released as part of an anonymous CVPR submission.
# BioFlow (Anonymous CVPR Submission)

This repository contains the official implementation of **BioFlow**, a biologically valid generative flow-matching framework for histology-conditioned spatial transcriptomics prediction.

> ⚠️ This codebase is released as part of an **anonymous submission**.  
> All identifying information has been removed to comply with the double-blind 
> review policy.

---

## Overview

Spatial transcriptomics (ST) prediction from histology images is typically approached
using regression or unconstrained generative models (e.g., diffusion or standard 
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

- **Multimodal Transformer architecture**  
  A lightweight DiT-style backbone processes WSI-derived features and learnable gene tokens.

- **Efficiency frontier**  
  Achieves state-of-the-art accuracy while requiring **2–5× less compute** than flow-based 
  baselines and up to **2000×** less compute than diffusion-based models.


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


