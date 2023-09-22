import { OrderedSet } from "molstar/lib/mol-data/int";
import { Mesh } from "molstar/lib/mol-geo/geometry/mesh/mesh";
import { computeMarchingCubesMesh } from "molstar/lib/mol-geo/util/marching-cubes/algorithm";
import { Box3D, PositionData } from "molstar/lib/mol-math/geometry";
import {
  DefaultGaussianDensityProps,
  computeGaussianDensity,
} from "molstar/lib/mol-math/geometry/gaussian-density";
import { Vec3 } from "molstar/lib/mol-math/linear-algebra";
import { Shape } from "molstar/lib/mol-model/shape";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { StateTransformer } from "molstar/lib/mol-state";
import { Color } from "molstar/lib/mol-util/color";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";
import { MeshBuilder } from "molstar/lib/mol-geo/geometry/mesh/mesh-builder";
import { addSphere } from "molstar/lib/mol-geo/geometry/mesh/builder/sphere";
import { arrayMinMax } from "molstar/lib/mol-util/array";

export type Sphere = {
  kind: "sphere";
  center: number[];
  radius: number;
  label: string;
  color: number;
};
export type SphereData = Sphere[];

const Transform = StateTransformer.builderFactory("namespace-id");
export const CreateSpheresProvider = Transform({
  name: "name-id",
  display: { name: "some cool name" },
  from: PluginStateObject.Root,
  to: PluginStateObject.Shape.Provider,
  params: {
    data: PD.Value<SphereData>([], { isHidden: true }),
  },
})({
  apply({ params }) {
    return new PluginStateObject.Shape.Provider({
      label: "Channels",
      data: params.data,
      params: Mesh.Params,
      geometryUtils: Mesh.Utils,
      getShape: (_, data) => createSpheresShape(data),
    });
  },
});

async function createSpheresShape(data: SphereData) {
  const builder = MeshBuilder.createState(512, 512);

  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    builder.currentGroup = i;
    addSphere(builder, p.center as Vec3, p.radius, 1);
  }

  const mesh = MeshBuilder.getMesh(builder);

  return Shape.create(
    "Sheres",
    {},
    mesh,
    (g) => Color(data[g].color),
    // await getMarchingMesh(data),
    // () => Color(0xff0000),
    () => 1,
    (g) => data[g].label
  );
}

// TODO: this is not working as intended
async function getMarchingMesh(data: SphereData) {
  const position: PositionData = {
    x: data.map((p) => p.center[0]),
    y: data.map((p) => p.center[1]),
    z: data.map((p) => p.center[2]),
    radius: data.map((p) => p.radius),
    indices: OrderedSet.ofSortedArray(data.map((_, i) => i)),
  };

  const [xMin, xMax] = arrayMinMax(position.x);
  const [yMin, yMax] = arrayMinMax(position.y);
  const [zMin, zMax] = arrayMinMax(position.z);

  const box = Box3D.create(
    Vec3.create(xMin, yMin, zMin),
    Vec3.create(xMax, yMax, zMax)
  );

  const radius = (index) => position.radius[index];

  // const props = DefaultGaussianDensityProps;
  const props = {
    resolution: 0.1,
    radiusOffset: 0,
    smoothness: 1.5,
  };

  const { idField, field, transform, radiusFactor } =
    await computeGaussianDensity(position, box, radius, props).run();

  const isoValue = Math.exp(-props.smoothness) / radiusFactor;

  const params = {
    isoLevel: isoValue,
    scalarField: field,
    idField: idField,
  };

  const surface = await computeMarchingCubesMesh(params).run();
  Mesh.transform(surface, transform);

  return surface;
}
