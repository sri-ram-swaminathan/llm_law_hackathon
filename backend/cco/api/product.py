from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..contracts import ProductOut, RegulatoryProfile
from ..db import get_session
from ..models import ProductRow
from . import deps

router = APIRouter(tags=["product"])


@router.get("/product", response_model=ProductOut)
def get_product(s: Session = Depends(get_session)):
    product, profile = deps.get_product(s)
    return ProductOut(product=product, profile=profile)


@router.put("/product/profile", response_model=RegulatoryProfile)
def put_profile(body: RegulatoryProfile, s: Session = Depends(get_session)):
    product, _ = deps.get_product(s)
    if body.confirmed_at is None:
        body = body.model_copy(update={"confirmed_at": datetime.now(timezone.utc)})
    s.get(ProductRow, product.id).profile = body.model_dump(mode="json")
    s.commit()
    return body
