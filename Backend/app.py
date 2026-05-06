# app.py

import os
from flask import Flask
from flask_cors import CORS

from db import db
from urls import register_routes

app = Flask(__name__)




app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")


app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"] = True





CORS(
    app,
    supports_credentials=True,
    origins=[
        "https://app.pimart.software",  # Custom domain (same-site cookies - RECOMMENDED)
        "https://admin.pimart.software",        # NEW admin / server frontend
        "https://digital-ocean-react.vercel.app",  # Keep for backward compatibility
        "https://server-frontend-digi-ocean.vercel.app",  # Keep for backward compatibility
        "http://localhost:5173"
    ],
    allow_headers=["Content-Type", "Authorization"],
)








DATABASE_URL = os.getenv("DATABASE_URL")

app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
    "pool_recycle": 280,
}

db.init_app(app)




with app.app_context():
    db.create_all()


# 

register_routes(app)




@app.route("/", methods=["GET"])
def index():
    return {"message": "Flask API running successfully"}




if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False,
        use_reloader=False,
    )