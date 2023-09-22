import { SbNcbrPartialCharges } from "molstar/lib/extensions/sb-ncbr";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import {
  DefaultPluginUISpec,
  PluginUISpec,
} from "molstar/lib/mol-plugin-ui/spec";
import { PluginSpec } from "molstar/lib/mol-plugin/spec";
import { CreateSpheresProvider, SphereData } from "./primitives";

const MySpec: PluginUISpec = {
  ...DefaultPluginUISpec(),
  layout: {
    initial: {
      isExpanded: true,
      showControls: true,
      regionState: {
        bottom: "full",
        left: "full",
        right: "full",
        top: "full",
      },
    },
  },
  behaviors: [
    PluginSpec.Behavior(SbNcbrPartialCharges),
    ...DefaultPluginUISpec().behaviors,
  ],
};

export class Context {
  plugin: PluginUIContext;

  constructor() {
    this.plugin = new PluginUIContext(MySpec);
    this.plugin.init();
  }

  async renderSpheres(data: SphereData) {
    const update = this.plugin.build();
    update
      .toRoot()
      .apply(CreateSpheresProvider, { data })
      .apply(StateTransforms.Representation.ShapeRepresentation3D, {
        alpha: 1,
      });
    await update.commit();
  }

  async load(url: string) {
    const cifFile = await fetch(url).then((r) => r.text());
    const data = await this.plugin.builders.data.rawData({ data: cifFile });
    const trajectory = await this.plugin.builders.structure.parseTrajectory(
      data,
      "mmcif"
    );

    await this.plugin.builders.structure.hierarchy.applyPreset(
      trajectory,
      "default"
    );
  }
}
