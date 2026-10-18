# ⛏️ Bitcoin Miner Simulator (Web UI & Idle Demo)

Un simulador visual interactivo de minería de Bitcoin con estética cyberpunk de terminal ASIC (*Antminer OS*), cálculo de hashes SHA-256 en vivo, sistema de recompensas y billetera virtual en tiempo real.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## ✨ Características

- 🔴 **Terminal de Hashing en Vivo**: Simula intentos continuos de resolución de prueba de trabajo (Proof-of-Work) con hashes SHA-256 en color rojo.
- 🟢 **Detección de Bloques (Alerta Verde)**: Cada 10 a 40 segundos encuentra un bloque exitoso, activando un destello verde esmeralda y una fanfarria sonora generada mediante la Web Audio API.
- 💰 **Billetera Virtual Integrada**: Incrementa automáticamente el saldo en `+1.00000000 BTC` por bloque encontrado y calcula su equivalencia en USD en tiempo real.
- 📊 **Telemetría en Vivo**: Simulación de fluctuaciones de temperatura de chips ASIC, velocidad de ventiladores (RPM), latencia al pool y consumo eléctrico (W).
- 📜 **Historial de Bloques (Ledger)**: Registro ordenado cronológicamente con altura de bloque, marcas de tiempo y confirmaciones de red (`6/6`).
- 💾 **Persistencia Local**: Guarda el progreso automáticamente en el `localStorage` del navegador.
- 🖥️ **Modo Pantalla Completa**: Interfaz inmersiva perfecta para monitores secundarios o props visuales.

---

## 🚀 Cómo Ejecutar

No requiere Node.js ni instalación de dependencias pesadas:

1. Clona este repositorio o descarga los archivos.
2. Abre `index.html` en cualquier navegador web moderno (Chrome, Edge, Firefox, Safari, Brave).
3. ¡Listo! El minador comenzará a calcular hashes inmediatamente.

---

## ⚙️ Configuración y Modos

- **Aviso al Encontrar Bitcoin**:
  - *Ventana Modal Emergente*: Muestra un diálogo de felicitación con los datos del bloque.
  - *Auto-acreditar*: Añade las ganancias automáticamente sin pausar la pantalla.
- **Velocidad de Hashing**: Ajustable entre 60ms (Ultrarrápido), 120ms (Normal) y 250ms (Lento).
- **Forzar Hallazgo**: Botón manual para simular un hallazgo inmediato.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
