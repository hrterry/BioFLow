import os
import json
import numpy as np
from typing import List
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import Dataset

from bioflow.hest_utils.st_dataset import load_adata
from bioflow.hest_utils.file_utils import read_assets_from_h5
from .sampling_utils import PatchSampler


class HESTDatasetPath:
    name: str | None = None
    h5_path: str | None = None
    h5ad_path: str | None = None
    gene_list_path: str | None = None

    def __init__(self, name, h5_path, h5ad_path, gene_list_path, **kwargs):
        self.name = name
        self.h5_path = h5_path
        self.h5ad_path = h5ad_path
        self.gene_list_path = gene_list_path

        for k, v in kwargs.items():
            setattr(self, k, v)


class SPData:
    features: torch.Tensor | None = None
    labels: torch.Tensor | None = None
    coords: torch.Tensor | None = None

    def __init__(self, features, labels, coords):
        self.features = features
        self.labels = labels
        self.coords = coords

        # decenter
        self.coords[:, 0] = self.coords[:, 0] - self.coords[:, 0].mean()
        self.coords[:, 1] = self.coords[:, 1] - self.coords[:, 1].mean()

    def __len__(self):
        return len(self.features)

    def chunk(self, index):
        return SPData(
            features=self.features[index],
            labels=self.labels[index],
            coords=self.coords[index]
        )


class HESTDataset(Dataset):
    def __init__(self, dataset: HESTDatasetPath, normalize_method, distribution="beta_3_1", sample_times=5):
        super().__init__()

        self.name = dataset.name
        data_dict, _ = read_assets_from_h5(dataset.h5_path)
        barcodes = data_dict["barcodes"].flatten().astype(str).tolist()
        coords = data_dict["coords"]
        embeddings = data_dict["embeddings"]

        with open(os.path.join(dataset.gene_list_path), 'r') as f:
            genes = json.load(f)['genes']
        
        self.gene_list = genes
        labels = load_adata(dataset.h5ad_path, genes=genes, barcodes=barcodes, normalize_method=normalize_method)
        labels = labels.values

        self.n_chunks = sample_times
        self.patch_sampler = PatchSampler(distribution)

        self.sp_dataset = SPData(
                features=torch.from_numpy(embeddings).float(),
                labels=torch.from_numpy(labels).float(),
                coords=torch.from_numpy(coords).float()
            )
        
    def __len__(self):
        return self.n_chunks

    def __getitem__(self, idx):
        return self.sp_dataset.chunk(self.patch_sampler(self.sp_dataset.coords))


class MultiHESTDataset(Dataset):
    def __init__(self, dataset_list: List[HESTDatasetPath], normalize_method, distribution="beta_3_1", sample_times=5):
        super().__init__()

        self.dataset_list = dataset_list
        self.sp_datasets = []
        self.n_chunks, self.sample_times = [], sample_times
        self.patch_sampler = PatchSampler(distribution)

        for i, dataset in enumerate(self.dataset_list):
            data_dict, _ = read_assets_from_h5(dataset.h5_path)
            barcodes = data_dict["barcodes"].flatten().astype(str).tolist()
            coords = data_dict["coords"]
            embeddings = data_dict["embeddings"]

            with open(os.path.join(dataset.gene_list_path), 'r') as f:
                genes = json.load(f)['genes']

            labels = load_adata(dataset.h5ad_path, genes=genes, barcodes=barcodes, normalize_method=normalize_method)
            labels = labels.values

            self.n_chunks.append(sample_times)

            self.sp_datasets.append(
                SPData(
                    features=torch.from_numpy(embeddings).float(),
                    labels=torch.from_numpy(labels).float(),
                    coords=torch.from_numpy(coords).float()
                )
            )
        
    def __len__(self):
        return sum(self.n_chunks)

    def __getitem__(self, idx):
        for i, n_chunk in enumerate(self.n_chunks):
            if idx < n_chunk:
                return self.sp_datasets[i].chunk(
                        self.patch_sampler(self.sp_datasets[i].coords)
                    )
            idx -= n_chunk


def padding_batcher():
    def batcher_dev(batch):
        features = [d.features for d in batch]
        labels = [d.labels for d in batch]
        coords = [d.coords for d in batch]

        max_len = max([x.size(0) for x in features])
        features = torch.stack([F.pad(x, (0, 0, 0, max_len - x.size(0))) for x in features])
        labels = torch.stack([F.pad(x, (0, 0, 0, max_len - x.size(0))) for x in labels])
        coords = torch.stack([F.pad(x, (0, 0, 0, max_len - x.size(0))) for x in coords])

        return features, coords, labels
    return batcher_dev

