"""Check production page text and accessible metadata after `npm run build`."""
from html.parser import HTMLParser
from pathlib import Path


class BrandingParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.text = []
        self.labels = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style'):
            self.hidden += 1
        for name in ('alt', 'aria-label', 'title'):
            if attrs.get(name):
                self.labels.append(attrs[name])
        if tag == 'meta' and attrs.get('content'):
            value = attrs['content']
            if not value.startswith(('https://', 'http://', '/')):
                self.labels.append(value)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden -= 1

    def handle_data(self, text):
        if not self.hidden:
            self.text.append(text)


for name in ('.next/server/app/index.html', '.next/server/app/sim.html', 'public/sim/index.html'):
    parser = BrandingParser()
    parser.feed(Path(name).read_text())
    for value in parser.text + parser.labels:
        assert 'kural' not in value.lower(), (name, value)
    assert any('Poppy' in value for value in parser.text), name

home = Path('.next/server/app/index.html').read_text()
assert '>Poppy</span>' in home
assert 'Poppy Robotics - Your Personal Robot Agent' in home
assert 'Meet Poppy' in home
assert 'Pre-order Poppy' in home
assert 'poppy-p-v1' in home
assert '/og.png?brand=poppy-v1' in home
for name in ('app/live-hero.tsx', 'app/loading-screen.tsx', 'app/waitlist-form.tsx', 'app/tool-gallery.tsx'):
    assert 'Kural' not in Path(name).read_text(), name
assert Path('simulator/dist/index.html').read_bytes() == Path('public/sim/index.html').read_bytes()
assert Path('simulator/public/favicon.svg').read_bytes() == Path('public/sim/favicon.svg').read_bytes()
print('Branding checks passed for homepage, metadata, accessibility, simulator, and generated assets.')
