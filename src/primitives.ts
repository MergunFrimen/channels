import { OrderedSet } from "molstar/lib/mol-data/int";
import { Mesh } from "molstar/lib/mol-geo/geometry/mesh/mesh";
import { computeMarchingCubesMesh } from "molstar/lib/mol-geo/util/marching-cubes/algorithm";
import {
  Box3D,
  PositionData,
  Sphere3D,
  fillGridDim,
} from "molstar/lib/mol-math/geometry";
import {
  DefaultGaussianDensityProps,
  GaussianDensityData,
  GaussianDensityProps,
} from "molstar/lib/mol-math/geometry/gaussian-density";
import { Mat4, Tensor, Vec3 } from "molstar/lib/mol-math/linear-algebra";
import { Shape } from "molstar/lib/mol-model/shape";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { StateTransformer } from "molstar/lib/mol-state";
import { Color } from "molstar/lib/mol-util/color";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";
import { MeshBuilder } from "molstar/lib/mol-geo/geometry/mesh/mesh-builder";
import { addSphere } from "molstar/lib/mol-geo/geometry/mesh/builder/sphere";
import { addCylinder } from "molstar/lib/mol-geo/geometry/mesh/builder/cylinder";
import { arrayMinMax } from "molstar/lib/mol-util/array";
import { WebGLContext } from "molstar/lib/mol-gl/webgl/context";
import { RuntimeContext, Task } from "molstar/lib/mol-task";
import { fasterExp } from "molstar/lib/mol-math/approx";

// radiusTop: 1,
//     radiusBottom: 1,
//     height: 1,
//     radialSegments: 8,
//     heightSegments: 1,
//     topCap: false,
//     bottomCap: false,
//     thetaStart: 0.0,
//     thetaLength: Math.PI * 2

export type Sphere = {
  kind: "sphere";
  center: number[];
  radius: number;
  label: string;
  color: number;
  group: number;
  id: number;
};
export type Cylinder = {
  kind: "cylinder";
  radiusTop: number;
  radiusBottom: number;
  start: number[];
  end: number[];
  label: string;
  color: number;
  distance: number;
  group: number;
};
export type PrimitivesData = Sphere[] | Cylinder[];

const Transform = StateTransformer.builderFactory("namespace-id");
export const CreateSpheresProvider = Transform({
  name: "name-id",
  display: { name: "some cool name" },
  from: PluginStateObject.Root,
  to: PluginStateObject.Shape.Provider,
  params: {
    data: PD.Value<PrimitivesData>([], { isHidden: false }),
    webgl: PD.Value<WebGLContext | null>(null),
  },
})({
  apply({ params }) {
    return new PluginStateObject.Shape.Provider({
      label: "Channels",
      data: params,
      params: Mesh.Params,
      geometryUtils: Mesh.Utils,
      getShape: (_, data) => createSpheresShape(data.data, data.webgl),
    });
  },
});

async function createSpheresShape(data: PrimitivesData, webgl: WebGLContext) {
  const builder = MeshBuilder.createState(512, 512);

  for (let i = 0; i < data.length; i += 1) {
    const p = data[i];
    builder.currentGroup = p.group;
    switch (p.kind) {
      case "sphere":
        addSphere(builder, p.center as Vec3, p.radius, 2);
        break;
      case "cylinder":
        addCylinder(builder, p.start as Vec3, p.end as Vec3, 1, {
          radiusTop: p.radiusTop,
          radiusBottom: p.radiusBottom,
          bottomCap: true,
          topCap: true,
        });
        break;
    }
  }

  let mesh = MeshBuilder.getMesh(builder);
  // mesh = await applyMarchingCubesAlgo(data, webgl, mesh);

  return Shape.create(
    "Sheres",
    {},
    mesh,
    (g) => Color(data[g].color),
    // () => Color(0xff0000),
    () => 1,
    (g) => data[g].label
  );
}

// ! The marching cubes algorithm doesn't work with so many balls
// ! When applying to two balls where the second ball is actually 4 balls in 1 it makes the second ball way too large
async function applyMarchingCubesAlgo(
  data: Sphere[],
  webgl: WebGLContext,
  mesh: Mesh
) {
  const position: PositionData = {
    x: data.map((p) => p.center[0]),
    y: data.map((p) => p.center[1]),
    z: data.map((p) => p.center[2]),
    radius: data.map((p) => p.radius),
    indices: OrderedSet.ofSortedArray(data.map((p) => p.id)),
    id: data.map((p) => p.id),
  };

  const [xMin, xMax] = arrayMinMax(position.x);
  const [yMin, yMax] = arrayMinMax(position.y);
  const [zMin, zMax] = arrayMinMax(position.z);

  // const box = Box3D.create(
  //   Vec3.create(xMin, yMin, zMin),
  //   Vec3.create(xMax, yMax, zMax)
  // );

  const box = Box3D.fromSphere3D(Box3D(), mesh.boundingSphere);

  const radius = (index) => position.radius[index];

  // const position: PositionData = {
  //   x: [0, 2, 2, 2, 2],
  //   y: [0, 2, 2, 2, 2],
  //   z: [0, 2, 2, 2, 2],
  //   indices: OrderedSet.ofSortedArray([0, 1, 2, 3, 4]),
  // };
  // const box = Box3D.create(Vec3.create(0, 0, 0), Vec3.create(2, 2, 2));
  // const radius = () => 1.8;

  const props = {
    ...DefaultGaussianDensityProps,
    // resolution: 0.1,
    // radiusOffset: 0,
    // smoothness: 1.5,
  };

  const { idField, field, radiusFactor } = await computeGaussianDensity(
    position,
    box,
    radius,
    {
      ...props,
    }
  ).run();

  // ! This doesn't do anything
  // const { transform } = await computeGaussianDensityTexture3d(
  //   position,
  //   box,
  //   radius,
  //   {
  //     ...props,
  //   },
  //   webgl
  // ).run();
  // Mesh.transform(mesh, transform);

  // const isoValue = Math.exp(-props.smoothness);
  const isoValue = Math.exp(-props.smoothness) / radiusFactor;
  // * this makes it a bit wider with more detail
  // const isoValue = 0.1;
  // console.log(isoValue);

  return await computeMarchingCubesMesh({
    isoLevel: isoValue,
    scalarField: field,
    idField: idField,
  }).run();
}

function computeGaussianDensity(
  position: PositionData,
  box: Box3D,
  radius: (index: number) => number,
  props: GaussianDensityProps
) {
  return Task.create("Gaussian Density", async (ctx) => {
    return await GaussianDensityCPU(ctx, position, box, radius, props);
  });
}

export async function GaussianDensityCPU(
  ctx: RuntimeContext,
  position: PositionData,
  box: Box3D,
  radius: (index: number) => number,
  props: GaussianDensityProps
): Promise<GaussianDensityData> {
  const { resolution, radiusOffset, smoothness } = props;
  const scaleFactor = 1 / resolution;

  const { indices, x, y, z, id } = position;
  const n = OrderedSet.size(indices);
  const radii = new Float32Array(n);

  let maxRadius = 0;
  for (let i = 0; i < n; ++i) {
    const r = radius(OrderedSet.getAt(indices, i)) + radiusOffset;
    if (maxRadius < r) maxRadius = r;
    radii[i] = r;
  }

  const pad = maxRadius * 2 + resolution;
  const expandedBox = Box3D.expand(Box3D(), box, Vec3.create(pad, pad, pad));
  const min = expandedBox.min;
  const scaledBox = Box3D.scale(Box3D(), expandedBox, scaleFactor);
  const dim = Box3D.size(Vec3(), scaledBox);
  Vec3.ceil(dim, dim);

  const space = Tensor.Space(dim, [0, 1, 2], Float32Array);
  const data = space.create();
  const field = Tensor.create(space, data);

  const idData = space.create();
  idData.fill(-1);
  const idField = Tensor.create(space, idData);

  const [dimX, dimY, dimZ] = dim;
  const iu = dimZ,
    iv = dimY,
    iuv = iu * iv;

  const gridx = fillGridDim(dim[0], min[0], resolution);
  const gridy = fillGridDim(dim[1], min[1], resolution);
  const gridz = fillGridDim(dim[2], min[2], resolution);

  const densData = space.create();

  const alpha = smoothness;
  const updateChunk = Math.ceil(
    100000 / (Math.pow(Math.pow(maxRadius, 3), 3) * scaleFactor)
  );

  function accumulateRange(begI: number, endI: number) {
    for (let i = begI; i < endI; ++i) {
      const j = OrderedSet.getAt(indices, i);
      const vx = x[j],
        vy = y[j],
        vz = z[j];

      const rad = radii[i];
      const rSq = rad * rad;
      const rSqInv = 1 / rSq;

      const r2 = rad * 2;
      const r2sq = r2 * r2;

      // Number of grid points, round this up...
      const ng = Math.ceil(r2 * scaleFactor);

      // Center of the atom, mapped to grid points (take floor)
      const iax = Math.floor(scaleFactor * (vx - min[0]));
      const iay = Math.floor(scaleFactor * (vy - min[1]));
      const iaz = Math.floor(scaleFactor * (vz - min[2]));

      // Extents of grid to consider for this atom
      const begX = Math.max(0, iax - ng);
      const begY = Math.max(0, iay - ng);
      const begZ = Math.max(0, iaz - ng);

      // Add two to these points:
      // - iax are floor'd values so this ensures coverage
      // - these are loop limits (exclusive)
      const endX = Math.min(dimX, iax + ng + 2);
      const endY = Math.min(dimY, iay + ng + 2);
      const endZ = Math.min(dimZ, iaz + ng + 2);

      for (let xi = begX; xi < endX; ++xi) {
        const dx = gridx[xi] - vx;
        const xIdx = xi * iuv;
        for (let yi = begY; yi < endY; ++yi) {
          const dy = gridy[yi] - vy;
          const dxySq = dx * dx + dy * dy;
          const xyIdx = yi * iu + xIdx;
          for (let zi = begZ; zi < endZ; ++zi) {
            const dz = gridz[zi] - vz;
            const dSq = dxySq + dz * dz;
            if (dSq <= r2sq) {
              const dens = fasterExp(-alpha * (dSq * rSqInv));
              // const dens = (rad * rad) / Math.max(0.000001, dx + dy + dz);
              const idx = zi + xyIdx;
              data[idx] += dens;
              if (dens > densData[idx]) {
                densData[idx] = dens;
                idData[idx] = id ? id[i] : i;
              }
            }
          }
        }
      }
    }
  }

  async function accumulate() {
    for (let i = 0; i < n; i += updateChunk) {
      accumulateRange(i, Math.min(i + updateChunk, n));

      if (ctx.shouldUpdate) {
        await ctx.update({
          message: "filling density grid",
          current: i,
          max: n,
        });
      }
    }
  }

  // console.time('gaussian density cpu')
  await accumulate();
  // console.timeEnd('gaussian density cpu')

  const transform = Mat4.identity();
  Mat4.fromScaling(transform, Vec3.create(resolution, resolution, resolution));
  Mat4.setTranslation(transform, expandedBox.min);

  return { field, idField, transform, radiusFactor: 1, resolution, maxRadius };
}
