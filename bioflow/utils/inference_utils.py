"""
Inference utility functions with biological constraints.
"""

import torch
import torch.nn.functional as F


def constrained_inference(model, diffusier, img_features, coords, args, 
                         n_sample_steps=None, use_non_negative=True):
    """
    Constrained inference function.
    
    Args:
        model: Trained model
        diffusier: Interpolant
        img_features: Image features [1, N_cells, feature_dim]
        coords: Coordinates [1, N_cells, 2]
        args: Configuration arguments
        n_sample_steps: Number of sampling steps, defaults to args.n_sample_steps
        use_non_negative: Whether to use non-negative constraint
    
    Returns:
        sample: Generated gene expression [1, N_cells, N_genes]
    """
    device = args.device
    if n_sample_steps is None:
        n_sample_steps = args.n_sample_steps
    
    exp_t1 = diffusier.sample_from_prior((1, img_features.shape[1], args.n_genes)).to(device)
    dt = 1.0 / n_sample_steps
    
    for s in range(n_sample_steps):
        t_val = float(s) / n_sample_steps
        t_tensor = torch.full((exp_t1.shape[0],), t_val, device=device)
        
        v_pred = model.inference(
            exp_t1, img_features, coords,
            t_tensor, predict=True
        )
        
        exp_t1 = exp_t1 + dt * v_pred
        
        if use_non_negative:
            exp_t1 = torch.clamp(exp_t1, min=0.0)
    
    return exp_t1


def soft_constrained_inference(model, diffusier, img_features, coords, args,
                              n_sample_steps=None, lambda_soft=1.0):
    """
    Soft constrained inference: uses soft penalty instead of hard constraint.
    
    Args:
        model: Trained model
        diffusier: Interpolant
        img_features: Image features [1, N_cells, feature_dim]
        coords: Coordinates [1, N_cells, 2]
        args: Configuration arguments
        n_sample_steps: Number of sampling steps
        lambda_soft: Soft constraint weight
    
    Returns:
        sample: Generated gene expression [1, N_cells, N_genes]
    """
    device = args.device
    if n_sample_steps is None:
        n_sample_steps = args.n_sample_steps
    
    exp_t1 = diffusier.sample_from_prior((1, img_features.shape[1], args.n_genes)).to(device)
    dt = 1.0 / n_sample_steps
    
    for s in range(n_sample_steps):
        t_val = float(s) / n_sample_steps
        t_tensor = torch.full((exp_t1.shape[0],), t_val, device=device)
        
        v_pred = model.inference(
            exp_t1, img_features, coords,
            t_tensor, predict=True
        )
        
        exp_t1 = exp_t1 + dt * v_pred
        
        if lambda_soft > 0:
            neg_penalty = F.relu(-exp_t1)
            exp_t1 = exp_t1 - lambda_soft * neg_penalty
    
    return exp_t1


def adaptive_constrained_inference(model, diffusier, img_features, coords, args,
                                  n_sample_steps=None, constraint_strength=1.0):
    """
    Adaptive constrained inference: adjusts constraint strength based on time step.
    
    Args:
        model: Trained model
        diffusier: Interpolant
        img_features: Image features [1, N_cells, feature_dim]
        coords: Coordinates [1, N_cells, 2]
        args: Configuration arguments
        n_sample_steps: Number of sampling steps
        constraint_strength: Constraint strength
    
    Returns:
        sample: Generated gene expression [1, N_cells, N_genes]
    """
    device = args.device
    if n_sample_steps is None:
        n_sample_steps = args.n_sample_steps
    
    exp_t1 = diffusier.sample_from_prior((1, img_features.shape[1], args.n_genes)).to(device)
    dt = 1.0 / n_sample_steps
    
    for s in range(n_sample_steps):
        t_val = float(s) / n_sample_steps
        t_tensor = torch.full((exp_t1.shape[0],), t_val, device=device)
        
        v_pred = model.inference(
            exp_t1, img_features, coords,
            t_tensor, predict=True
        )
        
        exp_t1 = exp_t1 + dt * v_pred
        
        current_strength = constraint_strength * (1 - t_val)
        
        if current_strength > 0:
            neg_penalty = F.relu(-exp_t1)
            exp_t1 = exp_t1 - current_strength * neg_penalty
            
            if t_val > 0.8:
                exp_t1 = torch.clamp(exp_t1, min=0.0)
    
    return exp_t1
