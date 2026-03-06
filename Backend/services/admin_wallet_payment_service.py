from db import db
from models.pending_wallet_payment import PendingWalletPayment
from models.ewallet import EWallet
from models.ewallet_transaction import EWalletTransaction
from models.sales_transaction import SalesTransaction
from models.sales_transaction_item import SalesTransactionItem
from models.item import Item
from ml.recommender.trainer import generate_recommendations_for_user
from flask import current_app

class AdminWalletPaymentService:

    @staticmethod
    def approve(pending_id):

        try:
            # -----------------------------
            # 🔒 Lock pending request
            # -----------------------------
            pending = (
                PendingWalletPayment.query
                .filter_by(id=pending_id, status="PENDING")
                .with_for_update()
                .first()
            )

            if not pending:
                raise Exception("Pending wallet payment not found")

            # -----------------------------
            # 🔒 Lock wallet
            # -----------------------------
            wallet = (
                EWallet.query
                .filter_by(user_id=pending.user_id)
                .with_for_update()
                .first()
            )

            if not wallet:
                raise Exception("Wallet not found")

            # -----------------------------
            # 🔒 Lock + validate all items
            # -----------------------------
            validated_items = []
            total = 0

            for entry in pending.cart:
                barcode = entry.get("barcode")
                qty = entry.get("quantity")

                if not barcode or not qty or qty <= 0:
                    raise Exception("Invalid cart item data")

                # Lock item row
                item = (
                    Item.query
                    .filter_by(barcode=barcode)
                    .with_for_update()
                    .first()
                )

                if not item:
                    raise Exception(f"Item not found: {barcode}")

                if item.quantity <= 0:
                    raise Exception(f"Item out of stock: {item.name}")

                if qty > item.quantity:
                    raise Exception(f"Insufficient stock for {item.name}")

                total += item.price * qty
                validated_items.append((item, qty))

            # -----------------------------
            # Check wallet balance again
            # -----------------------------
            if wallet.balance < total:
                raise Exception("Insufficient wallet balance")

            # -----------------------------
            # Deduct wallet
            # -----------------------------
            wallet.balance -= total

            # -----------------------------
            # Create sales transaction
            # -----------------------------
            transaction = SalesTransaction(user_id=pending.user_id)
            db.session.add(transaction)
            db.session.flush()

            # -----------------------------
            # Deduct stock + record items
            # -----------------------------
            for item, qty in validated_items:
                item.quantity -= qty

                db.session.add(SalesTransactionItem(
                    transaction_id=transaction.id,
                    item_id=item.id,
                    quantity=qty,
                    price_at_sale=item.price
                ))

            # -----------------------------
            # Wallet ledger
            # -----------------------------
            db.session.add(EWalletTransaction(
                wallet_id=wallet.id,
                amount=-total,
                type="payment",
                reference_id=transaction.id
            ))

            # -----------------------------
            # Mark pending as PAID only at the end
            # -----------------------------
            pending.status = "PAID"

            db.session.commit()

            try:
                generate_recommendations_for_user(pending.user_id)
            except Exception as e:
                current_app.logger.error(f"Failed to generate recommendations for user {pending.user_id}: {e}")
                
            return transaction.id

        except Exception:
            db.session.rollback()
            raise
