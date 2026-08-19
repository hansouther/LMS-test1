import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import db, client
from seed import seed
import routes_auth, routes_public, routes_admin, routes_student, routes_tutor, routes_proctor

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="LMS RBAC Platform")

app.include_router(routes_auth.router)
app.include_router(routes_public.router)
app.include_router(routes_admin.router)
app.include_router(routes_student.router)
app.include_router(routes_tutor.router)
app.include_router(routes_proctor.router)


@app.get("/api/")
async def root():
    return {"message": "LMS RBAC API aktif"}


origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("id", unique=True)
    await db.attempts.create_index([("student_id", 1), ("tryout_id", 1)])
    await db.questions.create_index("tryout_id")
    await db.login_attempts.create_index("identifier")
    await seed(os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"])
    logger.info("Startup complete: indexes ensured and seed executed.")


@app.on_event("shutdown")
async def shutdown():
    client.close()
