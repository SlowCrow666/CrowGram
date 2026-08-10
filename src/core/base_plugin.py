from fastapi import FastAPI
from typing import Dict, Any, Optional

class BasePlugin:
    """
    Базовый класс для всех плагинов CrowGram.
    Любой новый плагин должен наследоваться от этого класса.
    """
    
    name: str = "Unknown Plugin"
    version: str = "1.0.0"
    description: str = "Базовое описание плагина"
    
    def __init__(self):
        pass

    def init_plugin(self) -> bool:
        return True

    def register_routes(self, app: FastAPI):
        pass

    def get_ui_config(self) -> Optional[Dict[str, Any]]:
        return None
