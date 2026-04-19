from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.auth import AcceptInviteRequest, InviteInfoResponse, LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.organization import create_organization, get_organization_by_invite_token
from app.services.user import create_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if await get_user_by_email(db, body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    org = await create_organization(db, body.org_name)
    user = await create_user(db, body.email, body.password, body.full_name, org.id)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/invite/{token}", response_model=InviteInfoResponse)
async def get_invite_info(token: str, db: AsyncSession = Depends(get_db)) -> InviteInfoResponse:
    org = await get_organization_by_invite_token(db, token)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite link")
    return InviteInfoResponse(org_name=org.name)


@router.post("/invite/{token}", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def accept_invite(token: str, body: AcceptInviteRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    org = await get_organization_by_invite_token(db, token)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite link")
    if await get_user_by_email(db, body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = await create_user(db, body.email, body.password, body.full_name, org.id)
    return TokenResponse(access_token=create_access_token(str(user.id)))
