# Simulator local validation

The browser simulator is a separate Vite application in `simulator/`; its development server binds to `127.0.0.1` by default. From that directory:

```bash
npm ci
npm test
npm run test:worker
npm run build
python3 scripts/validate_model.py
```

The root Next.js app exposes the simulator at `/sim` through an iframe. Validate both the standalone simulator and the embedded route when changing integration behavior. Physics-level scripts `validate_kinematics.py` and `validate_dynamics.py` additionally require Python packages documented in `simulator/README.md`.