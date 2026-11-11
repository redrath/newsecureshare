from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import E2EEKeyProfile

@admin.register(E2EEKeyProfile)
class E2EEKeyProfileAdmin(admin.ModelAdmin):
    list_display = ('user',)
    search_fields = ('user__email',)