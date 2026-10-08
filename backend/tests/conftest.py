import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user("owner", password="pw-12345-long")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_login(user)
    return c


@pytest.fixture
def anon():
    return APIClient()
