import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(
    os.environ["MONGO_URL"],
    maxPoolSize=50,       # Menahan request berlebih di memori RAM backend
    minPoolSize=10,       # Menjaga koneksi tetap siaga
    maxIdleTimeMS=50000   # Memutus koneksi yang menganggur
)
db = client[os.environ["DB_NAME"]]
