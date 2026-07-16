from django.contrib.auth.models import AnonymousUser, Group, User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from .models import RolePermission
from .permissions import IsAdministrador, IsGestaoOrAdministrador


class PermissoesDinamicasTests(TestCase):
    """Garante que os dois nomes de permissão apliquem a mesma regra dinâmica."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = object()

    def _request(self, method, user):
        request = getattr(self.factory, method.lower())("/lojas/")
        request.user = user
        return request

    def _assert_permissions_equal(self, request):
        self.assertEqual(
            IsAdministrador().has_permission(request, self.view),
            IsGestaoOrAdministrador().has_permission(request, self.view),
        )

    def test_usuarios_anonimos_sao_bloqueados(self):
        request = self._request("GET", AnonymousUser())

        self._assert_permissions_equal(request)
        self.assertFalse(IsGestaoOrAdministrador().has_permission(request, self.view))

    def test_superusuarios_possuem_acesso_total(self):
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="senha-segura",
        )
        request = self._request("DELETE", user)

        self._assert_permissions_equal(request)
        self.assertTrue(IsGestaoOrAdministrador().has_permission(request, self.view))

    def test_permissoes_do_grupo_respeitam_o_metodo_http(self):
        group = Group.objects.create(name="Gestão")
        user = User.objects.create_user(username="gestao", password="senha-segura")
        user.groups.add(group)
        RolePermission.objects.create(
            group=group,
            module="lojas",
            can_view=True,
            can_create=False,
            can_edit=True,
            can_delete=False,
        )

        expectativas = {
            "GET": True,
            "POST": False,
            "PUT": True,
            "PATCH": True,
            "DELETE": False,
        }
        for method, esperado in expectativas.items():
            with self.subTest(method=method):
                request = self._request(method, user)
                self._assert_permissions_equal(request)
                self.assertEqual(
                    IsGestaoOrAdministrador().has_permission(request, self.view),
                    esperado,
                )
