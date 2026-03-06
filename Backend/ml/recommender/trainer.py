import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from models.item import Item
from models.ai_recommendation import AIRecommendation
from db import db
from .model import MFModel
from .dataset import build_interactions
from . import state

TOP_N = 5

class InteractionDataset(Dataset):
    def __init__(self, data):
        self.data = data
    def __len__(self):
        return len(self.data)
    def __getitem__(self, idx):
        return self.data[idx]
    
def generate_recommendations_for_user(user_id):
    if state.model is None or not state.user_map or not state.item_map:
        return False
    
    interactions = build_interactions()
    if user_id not in interactions:
        return False
    
    if user_id not in state.user_map:
        state.user_map[user_id] = len(state.user_map)
        
        old_model = state.model
        n_users = len(state.user_map)
        n_items = len(state.item_map)
        new_model = MFModel(n_users, n_items)
        
        new_model.user_emb.weight.data[:old_model.user_emb.num_embeddings] = \
            old_model.user_emb.weight.data
        new_model.item_emb.weight.data = old_model.item_emb.weight.data.clone()
        
        state.model = new_model
    
    uidx = state.user_map[user_id]
    user_purchases = interactions[user_id]

    with torch.no_grad():
        scores = {}
        
        for purchased_item_id in user_purchases.keys():
            if purchased_item_id not in state.item_map:
                continue
            
            purchased_iidx = state.item_map[purchased_item_id]
            purchased_emb = state.model.item_emb.weight[purchased_iidx]
            
            for iid, iidx in state.item_map.items():
                if iid == purchased_item_id:
                    continue
                
                item_emb = state.model.item_emb.weight[iidx]
                similarity = (purchased_emb * item_emb).sum().item()
                
                if iid not in scores:
                    scores[iid] = 0
                scores[iid] += similarity
    
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:TOP_N]
        state.score_matrix[user_id] = dict(sorted_scores)
    
    AIRecommendation.query.filter_by(user_id=user_id).delete()
    for iid, score in state.score_matrix[user_id].items():
        db.session.add(AIRecommendation(
            user_id=user_id,
            item_id=iid,
            score=score
        ))
    db.session.commit()
    
    return True

def retrain_model(epochs=20):
    interactions = build_interactions()
    
    logs = []
    logs.append(f"users with interactions: {len(interactions)}")
    
    if not interactions:
        state.model = None
        state.user_map = {}
        state.item_map = {}
        state.score_matrix = {}
        return {"logs": logs, "rmse": None, "mse": None}
    
    user_ids = list(interactions.keys())
    item_ids = list({
        iid
        for items in interactions.values()
        for iid in items.keys()
    })
    
    state.user_map = {uid: idx for idx, uid in enumerate(user_ids)}
    state.item_map = {iid: idx for idx, iid in enumerate(item_ids)}
    
    data = []
    all_quantities = []
    
    for uid, items_ in interactions.items():
        for iid, qty in items_.items():
            if iid in state.item_map:
                all_quantities.append(qty)
    
    import math
    max_qty = max(all_quantities) if all_quantities else 1
    
    for uid, items_ in interactions.items():
        uidx = state.user_map[uid]
        for iid, qty in items_.items():
            if iid in state.item_map:
                normalized = (math.log1p(qty) / math.log1p(max_qty)) * 2 - 1
                data.append((uidx, state.item_map[iid], float(normalized)))
    
    logs.append(f"total interaction points: {len(data)}")
    
    # torch.manual_seed(42)

    loader = DataLoader(
        InteractionDataset(data),
        batch_size=16,
        shuffle=True
    )
    
    model = MFModel(len(state.user_map), len(state.item_map))
    opt = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = nn.MSELoss()
    
    model.train()
    final_mse = 0.0
    
    for epoch in range(epochs):
        epoch_loss = 0.0
        epoch_batches = 0
        
        for u, i, q in loader:
            opt.zero_grad()
            pred = model(u.long(), i.long())
            loss = loss_fn(pred, q.float())
            loss.backward()
            opt.step()
            
            epoch_loss += loss.item()
            epoch_batches += 1
        
        if epoch == epochs - 1:
            final_mse = epoch_loss / epoch_batches
    
    final_rmse = final_mse ** 0.5
    
    model.eval()
    state.model = model
    state.score_matrix = {}
    
    with torch.no_grad():
        for uid, uidx in state.user_map.items():
            scores = []
            for iid, iidx in state.item_map.items():
                score = (
                    model.user_emb.weight[uidx]
                    * model.item_emb.weight[iidx]
                ).sum().item()
                scores.append((iid, score))
            scores.sort(key=lambda x: x[1], reverse=True)
            state.score_matrix[uid] = dict(scores[:TOP_N])
    
    logs.append("Writing recommendations to DB")
    
    AIRecommendation.query.delete()
    for uid, item_scores in state.score_matrix.items():
        for iid, score in item_scores.items():
            db.session.add(AIRecommendation(
                user_id=uid,
                item_id=iid,
                score=score
            ))
    
    db.session.commit()
    logs.append("DB commit complete")
    
    return {
        "logs": logs,
        "rmse": round(final_rmse, 4),
        "mse": round(final_mse, 4)
    }

def update_model_with_transactions(new_transactions, epochs=5):
    if state.model is None or not state.user_map or not state.item_map:
        retrain_model()
        return
    
    existing_user_ids = set(state.user_map.keys())
    existing_item_ids = set(state.item_map.keys())
    
    new_user_ids = {tx.user_id for tx in new_transactions} - existing_user_ids
    new_item_ids = set()
    for tx in new_transactions:
        new_item_ids.update(ti.item_id for ti in tx.items)
    new_item_ids -= existing_item_ids
    
    next_user_idx = len(state.user_map)
    for uid in new_user_ids:
        state.user_map[uid] = next_user_idx
        next_user_idx += 1
    
    next_item_idx = len(state.item_map)
    for iid in new_item_ids:
        state.item_map[iid] = next_item_idx
        next_item_idx += 1
    
    old_model = state.model
    n_users = len(state.user_map)
    n_items = len(state.item_map)
    new_model = MFModel(n_users, n_items)
    
    new_model.user_emb.weight.data[:old_model.user_emb.num_embeddings] = \
        old_model.user_emb.weight.data
    
    new_model.item_emb.weight.data[:old_model.item_emb.num_embeddings] = \
        old_model.item_emb.weight.data
    
    state.model = new_model
    
    data = []
    for tx in new_transactions:
        uidx = state.user_map[tx.user_id]
        for ti in tx.items:
            if ti.item_id in state.item_map:
                iidx = state.item_map[ti.item_id]
                data.append((uidx, iidx, float(ti.quantity)))
    
    if not data:
        return
    
    loader = DataLoader(
        InteractionDataset(data),
        batch_size=16,
        shuffle=True
    )
    
    opt = torch.optim.Adam(new_model.parameters(), lr=0.01)
    loss_fn = nn.MSELoss()
    
    new_model.train()
    for _ in range(epochs):
        for u, i, q in loader:
            opt.zero_grad()
            loss = loss_fn(new_model(u.long(), i.long()), q.float())
            loss.backward()
            opt.step()
    
    new_model.eval()
    affected_users = {tx.user_id for tx in new_transactions}
    
    with torch.no_grad():
        for uid in affected_users:
            uidx = state.user_map[uid]
            scores = []
            for iid, iidx in state.item_map.items():
                score = (
                    new_model.user_emb.weight[uidx]
                    * new_model.item_emb.weight[iidx]
                ).sum().item()
                scores.append((iid, score))
            scores.sort(key=lambda x: x[1], reverse=True)
            state.score_matrix[uid] = dict(scores[:TOP_N])