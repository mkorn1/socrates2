"""Configuration for the ADK Coach Service"""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env.local (or .env)
# Try .env.local first, then fallback to .env if it doesn't exist
load_dotenv('.env.local')
load_dotenv('.env')

class Config:
    """Application configuration"""
    
    # Google ADK Configuration
    GOOGLE_API_KEY: Optional[str] = os.getenv("GOOGLE_API_KEY")
    GOOGLE_GENAI_USE_VERTEXAI: bool = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "FALSE").upper() == "TRUE"
    
    # Service Account Configuration (for Vertex AI/ADK)
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_CLOUD_PROJECT_ID: Optional[str] = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
    GOOGLE_CLOUD_LOCATION: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    
    # Model Configuration
    # Note: gemini-2.0-flash-live-001 is only available in Generative AI API, not Vertex AI
    # For Vertex AI, use: gemini-2.0-flash-exp, gemini-2.0-flash, gemini-1.5-flash, or gemini-1.5-pro
    MODEL_NAME: str = os.getenv("MODEL_NAME", "gemini-2.0-flash-exp")
    
    # Server Configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # CORS Configuration
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")
    
    @classmethod
    def validate(cls) -> bool:
        """Validate that required configuration is present"""
        # For ADK, we need either service account credentials OR API key
        if not cls.GOOGLE_APPLICATION_CREDENTIALS and not cls.GOOGLE_API_KEY:
            raise ValueError(
                "Either GOOGLE_APPLICATION_CREDENTIALS (for ADK/Vertex AI) or "
                "GOOGLE_API_KEY (for Generative AI SDK) is required"
            )
        
        # If using Vertex AI, project ID is required
        if cls.GOOGLE_APPLICATION_CREDENTIALS and not cls.GOOGLE_CLOUD_PROJECT_ID:
            raise ValueError(
                "GOOGLE_CLOUD_PROJECT_ID is required when using service account credentials"
            )
        
        return True

