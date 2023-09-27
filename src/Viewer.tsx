import { useEffect, useState } from "react";
import { Context } from "./context";
import { Plugin } from "molstar/lib/mol-plugin-ui/plugin";
import { Cylinder, PrimitivesData, Sphere } from "./primitives";
import { ColorGenerator } from "molstar/lib/extensions/meshes/mesh-utils";
import { Script } from "molstar/lib/mol-script/script";
import { StructureSelection } from "molstar/lib/mol-model/structure";

export type ResidueKey = {
  labelCompId: string;
  labelSeqId: number;
  labelChainId: string;
};

export function Viewer({ context }: { context: Context }) {
  const [channels, setChannels] = useState<PrimitivesData[]>([
    [
      // {
      //   kind: "sphere",
      //   center: [0, 0, 0],
      //   radius: 1,
      //   color: 0xff0000,
      //   label: "S1",
      // },
      // {
      //   kind: "sphere",
      //   center: [0, 2, 0],
      //   radius: 1,
      //   color: 0xff0000,
      //   label: "S2",
      // },
      // {
      //   kind: "sphere",
      //   center: [0, 0, 2],
      //   radius: 1,
      //   color: 0xff0000,
      //   label: "C1",
      // },
      // {
      //   kind: "sphere",
      //   center: [2, 0, 0],
      //   radius: 1,
      //   color: 0xff0000,
      //   label: "C1",
      // },
      // {
      //   kind: "cylinder",
      //   color: ColorGenerator.next().value,
      //   start: [0, 0, 0],
      //   end: [0, 0.5, 0],
      //   label: "C1",
      //   radiusBottom: 1,
      //   radiusTop: 0.9,
      // },
      // {
      //   kind: "cylinder",
      //   color: ColorGenerator.next().value,
      //   start: [0, 0.5, 0],
      //   end: [0, 1, 0],
      //   label: "C2",
      //   radiusBottom: 0.9,
      //   radiusTop: 0.7,
      // },
    ],
  ]);

  // const [channels, setChannels] = useState<SphereData[]>([]);

  const pdbids = ["1ymg", "5mrw", "4nm9", "1jj2", "3tbg"];
  const pdbid = pdbids[0];

  function focus(key: ResidueKey) {
    const data =
      context.plugin.managers.structure.hierarchy.current.structures[0]
        .components[0].cell.obj?.data;
    if (!data) return;

    const { labelCompId, labelSeqId, labelChainId } = key;

    const selection = Script.getStructureSelection(
      (Q) =>
        Q.struct.generator.atomGroups({
          "atom-test": Q.core.logic.and([
            Q.core.rel.eq([
              Q.struct.atomProperty.macromolecular.label_comp_id(),
              labelCompId,
            ]),
            Q.core.rel.eq([
              Q.struct.atomProperty.macromolecular.label_seq_id(),
              labelSeqId,
            ]),
            Q.core.rel.eq([
              Q.struct.atomProperty.macromolecular.label_asym_id(),
              labelChainId,
            ]),
          ]),
        }),
      data
    );

    const loci = StructureSelection.toLociWithSourceUnits(selection);
    context.plugin.managers.interactivity.lociHighlights.highlightOnly({
      loci,
    });
    context.plugin.managers.interactivity.lociSelects.selectOnly({ loci });
    context.plugin.managers.camera.focusLoci(loci);
    context.plugin.managers.structure.focus.setFromLoci(loci);
  }

  useEffect(() => {
    async function fetchSpheres() {
      const response = await fetch(
        `https://webchem.ncbr.muni.cz/API/ChannelsDB/PDB/${pdbid}`
      );
      const json = await response.json();
      const channels: PrimitivesData[] = [];
      let id = 0;
      json.Channels.ReviewedChannels.forEach((channel: any, i: any) => {
        const color = ColorGenerator.next().value;
        const c: Sphere[] = [];
        for (let j = 0; j < channel.Profile.length; j += 1) {
          const entry = channel.Profile[j];
          c.push({
            kind: "sphere",
            center: [entry.X, entry.Y, entry.Z],
            radius: entry.Radius,
            color,
            label: `Channel ${i} | Ball ${j}`,
            group: i,
            id: id,
          });

          id += 1;
        }
        channels.push(c);
      });
      setChannels(channels);
    }

    async function fetchCylinders1() {
      const response = await fetch(
        `https://webchem.ncbr.muni.cz/API/ChannelsDB/PDB/${pdbid}`
      );
      const json = await response.json();
      const channels: PrimitivesData[] = [];

      json.Channels.ReviewedChannels.forEach((channel: any, i: any) => {
        const color = ColorGenerator.next().value;
        const c: Cylinder[] = [];
        for (let j = 1; j < channel.Profile.length; j += 1) {
          const prev = channel.Profile[j - 1];
          const current = channel.Profile[j];
          c.push({
            kind: "cylinder",
            color,
            start: [prev.X, prev.Y, prev.Z],
            end: [current.X, current.Y, current.Z],
            label: `Channel ${i} | Ball ${j}`,
            radiusBottom: prev.Radius,
            radiusTop: current.Radius,
            distance: current.Distance,
            group: i,
          });
        }
        channels.push(c);
      });
      setChannels(channels);
    }

    async function fetchCylinders2() {
      const response = await fetch(
        `https://webchem.ncbr.muni.cz/API/ChannelsDB/PDB/${pdbid}`
      );
      const json = await response.json();
      const channels: PrimitivesData[] = [];

      json.Channels.ReviewedChannels.forEach((channel: any, i: any) => {
        const c: Cylinder[] = [];
        for (let j = 1; j < channel.Layers.LayersInfo.length; j += 1) {
          const prev = channel.Layers.LayersInfo[j - 1].LayerGeometry;
          const entry = channel.Layers.LayersInfo[j].LayerGeometry;
          c.push({
            kind: "cylinder",
            color: ColorGenerator.next().value,
            start: [0 + prev.EndDistance, 0, 0],
            end: [0 + entry.EndDistance, 0, 0],
            label: `Channel ${i} | Ball ${j}`,
            radiusBottom: entry.MinRadius,
            radiusTop: prev.MinRadius,
            distance: 1,
            group: i,
          });
        }
        channels.push(c);
      });
      setChannels(channels);
    }

    fetchSpheres();
    // fetchCylinders1();
    // fetchCylinders2();
    context.load(`https://files.rcsb.org/view/${pdbid}.cif`);
  }, []);

  channels.forEach((channel) => {
    context.renderSpheres(channel);
  });

  return (
    <div
      className=""
      style={{
        flex: "1 1 auto",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          // inset: "100px 0px 0px 100px",
          position: "relative",
          height: "500px",
          width: "800px",
        }}
      >
        <Plugin plugin={context.plugin} />
      </div>

      <button
        onClick={() =>
          focus({
            labelCompId: "ALA",
            labelSeqId: 117,
            labelChainId: "A",
          })
        }
        style={{
          width: "100px",
        }}
      >
        Focus
      </button>
    </div>
  );
}
