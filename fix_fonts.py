import re

path = 'frontend/src/pages/LeaderboardPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Google Fonts import
c = c.replace(
    "family=Cinzel:wght@400;600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,600&display=swap",
    "family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=Inter:wght@400;500;600;700&display=swap"
)

# 2. CSS class font-family: Cinzel  -> Playfair Display
c = c.replace("font-family:'Cinzel',serif", "font-family:'Playfair Display',serif")
c = c.replace("font-family:'Cinzel'", "font-family:'Playfair Display'")

# 3. CSS class font-family: Cormorant Garamond -> Inter
c = c.replace("font-family:'Cormorant Garamond',serif", "font-family:'Inter',sans-serif")
c = c.replace("font-family:'Cormorant Garamond'", "font-family:'Inter'")

# 4. JSX inline fontFamily strings  (uses double-quote JSX style)
c = c.replace("fontFamily:'Playfair Display', serif", "fontFamily:'Playfair Display',serif")  # normalize
c = c.replace('''fontFamily:"'Cinzel',serif"''',   '''fontFamily:"'Playfair Display',serif"''')
c = c.replace('''fontFamily:"'Cinzel'"''',           '''fontFamily:"'Playfair Display'"''')
c = c.replace('''fontFamily:"'Cormorant Garamond',serif"''', '''fontFamily:"'Inter',sans-serif"''')
c = c.replace('''fontFamily:"'Cormorant Garamond'"''',       '''fontFamily:"'Inter'"''')

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Font replacement complete!")
# Verify
remaining = [line.strip() for line in c.split('\n') if 'Cinzel' in line or 'Cormorant' in line]
if remaining:
    print("Remaining references:")
    for r in remaining:
        print(" ", r[:120])
else:
    print("All Cinzel/Cormorant references replaced successfully.")
