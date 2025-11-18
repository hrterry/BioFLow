import torch
from .noise import PriorSampler


class Interpolant:
    def __init__(self, prior_sample_type, normalize=True, device=None, **kwargs):
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            else:
                self.device = "cpu"
        else:
            self.device = device

        self.prior_sampler = PriorSampler(prior_sample_type, device=self.device, **kwargs)
        self.normalize = normalize
    
    def alpha(self, t):
        """
        Compute linear probability path alpha value (alpha(t) = t).
        
        Args:
            t: Time step tensor [B] or scalar
        
        Returns:
            Alpha value with same shape as t
        """
        return t
    
    def sample_from_prior(self, shape):
        exp = self.prior_sampler.sample(shape).to(self.device)
        if self.normalize:
            exp = torch.log(exp + 1)
        return exp

    def sample_t(self, shape):
        return torch.rand(shape)

    def corrupt_exp(self, exp):
        # exp: [B, n_cells, n_genes]
        t = self.sample_t((exp.shape[0],)).to(self.device)
        if exp.shape[0] > 1:
            t = t.squeeze(-1)
        exp_0 = self.sample_from_prior(exp.shape).to(self.device)
        
        alpha_t = self.alpha(t)
        exp_t = exp_0 * (1 - alpha_t[:, None, None]) + exp * alpha_t[:, None, None]
        return exp_t, exp_0, t

    def denoise(self, v_pred, exp_t, t, d_t):
        # v_pred: model-predicted velocity field (Y - Y0), same shape as exp_t
        # exp_t: [B, n_cells, n_genes]
        # t: [B]
        # d_t: [B]
        return exp_t + d_t[:, None, None] * v_pred
    
    def get_target_velocity(self, exp, exp_0, t):
        """
        Compute target velocity field (standard Flow Matching).
        
        Args:
            exp: Target expression [B, n_cells, n_genes]
            exp_0: Initial expression [B, n_cells, n_genes]  
            t: Time step [B]
        
        Returns:
            target_velocity: Target velocity field [B, n_cells, n_genes]
        """
        return (exp - exp_0) / (1 - t[:, None, None] + 1e-8)
