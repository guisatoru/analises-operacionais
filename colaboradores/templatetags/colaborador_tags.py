from django import template

register = template.Library()

@register.simple_tag(takes_context=True)
def query_params(context, **overrides):
    """
    Retorna todos os parâmetros de query atuais como string,
    permitindo sobrescrever alguns (ex: page).
    """
    request = context['request']
    params = request.GET.copy()
    
    # Aplica overrides (ex: page=2)
    for key, value in overrides.items():
        params[key] = value
    
    return params.urlencode()