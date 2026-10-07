import * as THREE from 'three';

/** Share one observer across every surface, including grid lines and scenery. */
export class RelativisticMaterials {
  readonly observerBeta = { value: new THREE.Vector3() };
  readonly observerPosition = { value: new THREE.Vector3() };
  readonly inverseWorld = { value: new THREE.Matrix4() };
  readonly strength = { value: 1 };
  private readonly stationaryBeta = { value: new THREE.Vector3() };
  private readonly installed = new WeakSet<THREE.Material>();

  attach(root: THREE.Object3D, emitterBeta = this.stationaryBeta): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
      // Three's default bounding-sphere scale assumes orthogonal matrix columns.
      // Diagonal contraction introduces shear; keep these small room meshes
      // visible instead of letting an underestimated bound pop near the camera.
      object.frustumCulled = false;
      const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (this.installed.has(material)) continue;
        this.installed.add(material);
        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, {
            relObserverBeta: this.observerBeta,
            relEmitterBeta: emitterBeta,
            relObserverPosition: this.observerPosition,
            relInverseWorld: this.inverseWorld,
            relStrength: this.strength,
          });
          shader.vertexShader = `varying vec3 relPosition;\nuniform mat4 relInverseWorld;\n${shader.vertexShader}`
            .replace('#include <project_vertex>', `#include <project_vertex>
              relPosition = (relInverseWorld * modelMatrix * vec4(transformed, 1.0)).xyz;`);
          shader.fragmentShader = `
            varying vec3 relPosition;
            uniform vec3 relObserverBeta;
            uniform vec3 relEmitterBeta;
            uniform vec3 relObserverPosition;
            uniform float relStrength;
            ${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
              vec3 relOffset = relPosition - relObserverPosition;
              vec3 relSightline = relOffset / max(length(relOffset), 0.001);
              float relObserverGamma = inversesqrt(max(1.0 - dot(relObserverBeta, relObserverBeta), 0.0001));
              float relEmitterGamma = inversesqrt(max(1.0 - dot(relEmitterBeta, relEmitterBeta), 0.0001));
              float relDoppler = relObserverGamma * (1.0 + dot(relObserverBeta, relSightline))
                / max(relEmitterGamma * (1.0 + dot(relEmitterBeta, relSightline)), 0.0001);
              float relShift = clamp(log2(max(relDoppler, 0.0001)) * 0.5, -1.0, 1.0);
              vec3 relTint = relShift >= 0.0 ? vec3(0.22, 0.55, 1.0) : vec3(1.0, 0.18, 0.10);
              float relLuminance = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
              outgoingLight = mix(outgoingLight, relTint * relLuminance * 1.65, abs(relShift) * 0.72 * relStrength);
              #include <opaque_fragment>`);
        };
        material.customProgramCacheKey = () => 'observer-doppler-v1';
        material.needsUpdate = true;
      }
    });
  }
}
