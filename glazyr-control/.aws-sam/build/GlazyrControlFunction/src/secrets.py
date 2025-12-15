import os
from typing import Optional


def _get_secret_value_from_aws(secret_arn: str) -> Optional[str]:
    # boto3 is available in AWS Lambda runtime by default.
    try:
        import boto3  # type: ignore
    except Exception:
        return None
    try:
        client = boto3.client("secretsmanager")
        res = client.get_secret_value(SecretId=secret_arn)
        if "SecretString" in res and isinstance(res["SecretString"], str):
            return res["SecretString"]
    except Exception:
        return None
    return None


def ensure_openai_key_from_secrets_manager() -> bool:
    """
    If OPENAI_API_KEY is unset, try to load it from AWS Secrets Manager.

    Env:
      - OPENAI_API_KEY_SECRET_ARN: ARN of the secret containing the API key string
    """
    if os.getenv("OPENAI_API_KEY", "").strip():
        return True
    arn = os.getenv("OPENAI_API_KEY_SECRET_ARN", "").strip()
    if not arn:
        return False
    val = _get_secret_value_from_aws(arn)
    if not val:
        return False
    os.environ["OPENAI_API_KEY"] = val.strip()
    return bool(os.environ["OPENAI_API_KEY"])


def get_google_places_api_key() -> Optional[str]:
    """
    Get Google Places API key from environment or AWS Secrets Manager.
    
    Env:
      - GOOGLE_PLACES_API_KEY: Direct API key (for development)
      - GOOGLE_PLACES_API_KEY_SECRET_ARN: ARN of the secret containing the API key
    
    Returns:
        API key string, or None if not configured
    """
    # First check direct env var
    key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if key:
        return key
    
    # Try secrets manager
    arn = os.getenv("GOOGLE_PLACES_API_KEY_SECRET_ARN", "").strip()
    if arn:
        val = _get_secret_value_from_aws(arn)
        if val:
            return val.strip()
    
    return None

