# Routes module initialization
from .hr import router as hr_router, init_router as init_hr_router
from .crm import router as crm_router, init_router as init_crm_router

__all__ = ['hr_router', 'init_hr_router', 'crm_router', 'init_crm_router']
