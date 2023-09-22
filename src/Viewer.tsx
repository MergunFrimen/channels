import { useEffect, useState } from "react";
import { Context } from "./context";
import { Plugin } from "molstar/lib/mol-plugin-ui/plugin";
import { SphereData } from "./primitives";
import { ColorGenerator } from "molstar/lib/extensions/meshes/mesh-utils";

export function Viewer({ context }: { context: Context }) {
  // const [channels, setChannels] = useState<PrimitivesData[]>([
  //   [
  //     {
  //       kind: "sphere",
  //       center: [0, 0, 0],
  //       radius: 1,
  //       color: 0xff0000,
  //       label: "S1",
  //     },
  //     {
  //       kind: "sphere",
  //       center: [0, 2, 0],
  //       radius: 1,
  //       color: 0xff0000,
  //       label: "S2",
  //     },
  //     {
  //       kind: "sphere",
  //       center: [0, 0, 2],
  //       radius: 1,
  //       color: 0xff0000,
  //       label: "C1",
  //     },
  //     {
  //       kind: "sphere",
  //       center: [2, 0, 0],
  //       radius: 1,
  //       color: 0xff0000,
  //       label: "C1",
  //     },
  //   ],
  // ]);

  const [channels, setChannels] = useState<SphereData[]>([]);

  const pdbid = "1ymg";

  useEffect(() => {
    async function fetchData() {
      const response = await fetch(
        `https://webchem.ncbr.muni.cz/API/ChannelsDB/PDB/${pdbid}`
      );
      const json = await response.json();
      const channels: any[] = [];
      json.Channels.ReviewedChannels.forEach((channel, i) => {
        const color = ColorGenerator.next().value;
        const c = [];
        for (let j = 0; j < channel.Profile.length; j += 1) {
          const entry = channel.Profile[j];
          c.push({
            kind: "sphere",
            center: [entry.X, entry.Y, entry.Z],
            radius: entry.FreeRadius,
            color,
            label: `Channel ${i} | Ball ${j}`,
          });
        }
        channels.push(c);
        // channels.push(
        //   channel.Profile.map((entry, j) => {
        //     return {
        //       kind: "sphere",
        //       center: [entry.X, entry.Y, entry.Z],
        //       radius: entry.FreeRadius,
        //       color,
        //       label: `Channel ${i} | Ball ${j}`,
        //     };
        //   })
        // );
      });
      setChannels(channels);
    }

    fetchData();
    context.load(`https://files.rcsb.org/view/${pdbid}.cif`);
  }, []);

  channels.forEach((channel) => {
    context.renderSpheres(channel);
  });

  return (
    <>
      <Plugin plugin={context.plugin} />
    </>
  );
}
