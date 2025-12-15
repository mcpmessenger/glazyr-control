from mangum import Mangum

from .main import app

# AWS Lambda handler for FastAPI (via Mangum)
handler = Mangum(app)

