# BioFLow
Official implementation of the BioFlow: Biologically Valid Generative Flow for Histology-Conditioned Spatial Transcriptomics Prediction. Released as part of an anonymous CVPR submission.

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
  Achieves state-of-the-art accuracy while requiring **4–100× less compute** than flow-based 
  baselines and up to **10,000×** less compute than diffusion-based models.


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


---

## 代码结构

本项目采用模块化设计，主要包含以下几个部分：

### 核心训练与测试脚本

#### `train.py`
主训练脚本，负责：
- 模型训练流程管理（多数据集、多fold交叉验证）
- 训练过程监控与结果保存（包括Pearson相关系数、MSE、MAE等指标）
- 早停机制和模型检查点保存
- WandB日志记录

#### `test.py`
测试评估脚本，提供：
- 模型推理和性能评估
- 支持带约束的推理（非负约束）
- 计算多种评估指标：Pearson相关系数、L2误差、R²分数等

### 数据模块 (`data/`)

#### `dataset.py`
数据集类实现：
- **`HESTDatasetPath`**: 数据集路径配置类，管理h5特征文件、h5ad表达文件和基因列表路径
- **`SPData`**: 空间转录组数据容器，包含图像特征、基因表达标签和坐标信息，自动进行坐标去中心化
- **`HESTDataset`**: 单样本数据集，支持多种patch采样分布和归一化方法
- **`MultiHESTDataset`**: 多样本数据集，用于训练时合并多个样本
- **`padding_batcher()`**: 批处理函数，处理变长序列的padding对齐

#### `normalize_utils.py`
数据归一化工具：
- **`log1p`**: log(x+1)归一化
- **`stdiff_normalize`**: STDiff风格的归一化（total count归一化 + log1p + MaxAbs缩放 + 映射到[-1,1]）
- **`scVGAE_normalize`**: scVGAE风格的归一化（library size归一化 + sqrt变换）
- **`get_normalize_method()`**: 归一化方法工厂函数

#### `sampling_utils.py`
空间采样工具：
- **`PatchSampler`**: 基于KDTree的最近邻patch采样器
- 支持多种采样分布（通过`distribution_utils`配置）
- 从空间坐标中采样连续的空间区域

#### `distribution_utils.py`
采样分布定义：
- **`constant_distribution`**: 常数分布
- **`uniform_distribution`**: 均匀分布
- **`beta_distribution`**: Beta分布（默认alpha=3, beta=9）
- **`cosine_distribution`**: 余弦分布
- **`square_root_distribution`**: 平方根分布
- **`square_distribution`**: 平方分布

### 模型模块 (`model/`)

#### `vpredictor.py` (MMDiT模型)
多模态DiT (MMDiT) 速度预测器，核心模型实现：
- **`TimestepEmbedder`**: 时间步嵌入，使用正弦位置编码
- **`DecomposedAttention`**: 分解注意力机制，包含四个可学习门控（img↔img, img↔gene, gene↔img, gene↔gene）
- **`MMDiTBlock`**: MMDiT Transformer块，使用ReZero残差缩放
- **`MMDiTTransformer`**: 统一序列Transformer，将图像token和基因token拼接处理
- **`MMDiTDenoiser`**: 高层封装，输出速度场预测

#### `denoiser.py`
传统去噪器模型（可选）：
- **`TimestepEmbedder`**: 时间步嵌入
- **`Denoiser`**: 基于DiT的去噪器

#### `transformer.py`
Transformer基础组件：
- **`Attention`**: 多头自注意力机制
- **`Mlp`**: 多层感知机
- **`DiTBlock`**: DiT块，使用自适应层归一化（adaLN-Zero）
- **`DiTTransformer`**: 完整的DiT Transformer架构

#### `config.py`
模型配置类：
- **`ModelConfig`**: 模型超参数配置，包括隐藏维度、层数、注意力头数等

#### `fa.py`
Frame Averaging模块：
- **`FrameAveraging`**: 实现等变性的frame averaging操作，用于处理空间坐标的旋转等变性

### 流匹配模块 (`flow/`)

#### `interpolant.py`
流匹配插值器，核心组件：
- **`Interpolant`**: 流匹配插值器类
  - 支持多种先验分布采样（高斯、零、ZINB等）
  - 使用线性概率路径和标准Flow Matching
  - `corrupt_exp()`: 对基因表达进行噪声扰动
  - `get_target_velocity()`: 计算目标速度场

#### `noise.py`
先验分布采样器：
- **`PriorSampler`**: 先验分布采样器
  - **`gaussian_prior`**: 高斯先验
  - **`all_zeros`**: 零先验
  - **ZINB先验**: 使用scvi-tools的ZeroInflatedNegativeBinomial

### 工具模块 (`utils/`)

#### `hotspot_weighting.py`
热点加权模块：
- **`HotspotWeightingCalculator`**: 计算spot-level的hotspot权重
  - 预计算全局基因表达百分位数
  - 基于gene difficulty选择focus genes
  - 计算spot的hotspot权重（软权重，使用sigmoid平滑）
  - 集成到损失函数中

#### `inference_utils.py`
推理工具函数：
- **`constrained_inference()`**: 带非负约束的推理函数
- **`soft_constrained_inference()`**: 软约束推理（使用penalty而非hard constraint）
- **`adaptive_constrained_inference()`**: 自适应约束推理（根据时间步调整约束强度）

#### `utils.py`
通用工具函数：
- **`set_random_seed()`**: 设置随机种子（Python, NumPy, PyTorch）
- **`merge_fold_results()`**: 合并多fold交叉验证结果
- **`get_current_time()`**: 获取当前时间戳（用于实验命名）
- **`symbol2ensembl_id()`**: 基因符号到Ensembl ID的转换

---

