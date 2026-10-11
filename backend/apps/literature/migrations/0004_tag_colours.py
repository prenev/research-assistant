from django.db import migrations

COLOURS = [
    "#2a78d6", "#eb6834", "#1baf7a", "#8a5cd6", "#d6457a", "#c79a1c",
    "#1f9bb5", "#6b8e23", "#c2463d", "#5c6bc0", "#8d6e63", "#607d8b",
]  # fmt: skip


def fill_colours(apps, schema_editor):
    Tag = apps.get_model("literature", "Tag")
    for tag in Tag.objects.filter(colour=""):
        tag.colour = COLOURS[sum(map(ord, tag.slug)) % len(COLOURS)]
        tag.save(update_fields=["colour"])


class Migration(migrations.Migration):
    dependencies = [("literature", "0003_tags_everywhere")]
    operations = [migrations.RunPython(fill_colours, migrations.RunPython.noop)]
