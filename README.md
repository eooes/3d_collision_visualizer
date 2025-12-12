# 3D Collision Visualizer

A web-based 3D visualizer that accurately simulates the collision of a user-uploaded 3D model with 23 concentric cylindrical layers. The application displays these collisions by illuminating corresponding areas on "unfolded" 2D representations of the layers.

## Features

- **3D Model Upload**: Upload custom 3D models to test against the cylindrical layers.
- **Collision Detection**: Accurate mesh-based collision detection using `three-mesh-bvh`.
- **Visualization**:
    - 3D view of the object and cylindrical layers.
    - 2D "unfolded" view showing collision maps.
- **Controls**:
    - Adjust 3D object properties (visibility, opacity, scale, rotation speed).
    - Control layer visibility and opacity.
    - Fine-tune position and rotation.
- **Export**: Export layer visualizations as images or video.

## Visuals

### Application Layout
![Application Layout](https://raw.githubusercontent.com/eooes/3d_collision_visualizer/refs/heads/main/layout.png)

This image shows the 3D viewport from top-down view where the object and cylindrical layers are 23 layers. it's not exact cylindrical but it's close enough.

### Visualization Overview
![Visualization Output](https://github.com/eooes/3d_collision_visualizer/blob/main/readme%20.png?raw=true)

The collision detection in action. It likely depicts the "unfolded" 2D view or the cumulative effect of the 3D object intersecting with the concentric cylindrical layers, resulting in the collision map.


## Getting Started

### Prerequisites

- Node.js installed on your machine.

### Installation

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

### Running the Application

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to the URL provided (usually `http://localhost:5173`).

### Building for Production

To build the application for production:

```bash
npm run build
```

## Technologies Used

- [Three.js](https://threejs.org/) - 3D Library
- [Vite](https://vitejs.dev/) - Build tool
- [lil-gui](https://lil-gui.georgealways.com/) - Floating GUI controls
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) - BVH implementation for fast geometry raycasting and spatial queries.
