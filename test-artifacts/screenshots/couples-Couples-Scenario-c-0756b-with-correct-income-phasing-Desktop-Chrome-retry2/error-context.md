# Page snapshot

```yaml
- generic [ref=e1]:
  - progressbar [ref=e3]
  - generic [ref=e4]:
    - text: ✨ Recommended
    - generic [ref=e5]:
      - generic [ref=e6]:
        - heading "How old are you?" [level=2] [ref=e7]
        - paragraph [ref=e8]: Your current age
      - generic [ref=e10]:
        - spinbutton [active] [ref=e12]: "55"
        - paragraph [ref=e13]: Enter your age in years
      - generic [ref=e14]:
        - button "Back" [ref=e15] [cursor=pointer]
        - button "Next" [ref=e16] [cursor=pointer]
  - generic [ref=e17]:
    - generic [ref=e18]:
      - generic [ref=e19]: 📊 Live Estimate
      - button "More info" [ref=e20] [cursor=pointer]: ℹ️
    - generic [ref=e21]:
      - generic [ref=e22]:
        - generic [ref=e23]: Retire at
        - generic [ref=e24]: —
      - generic [ref=e25]:
        - generic [ref=e26]: Target net
        - generic [ref=e27]: —
      - generic [ref=e28]:
        - generic [ref=e29]: Projected pot
        - generic [ref=e30]: —
      - generic [ref=e31]:
        - generic [ref=e32]: Gap/Surplus
        - generic [ref=e33]: —
      - generic [ref=e34]: Enter age and retirement age to see estimate
    - generic [ref=e35]: "Estimate basis: 4% rule + your inputs"
  - contentinfo [ref=e37]: RetireLens Pro v0.9.3
```