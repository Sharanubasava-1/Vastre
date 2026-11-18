import Drawer from "../Drawer";
const tops = [
  ["S", 96, 90, 68],
  ["M", 101, 95, 70],
  ["L", 106, 100, 72],
  ["XL", 111, 105, 74],
  ["XXL", 116, 110, 76],
];
const bottoms = [
  ["S", 76, 76],
  ["M", 81, 78],
  ["L", 86, 80],
  ["XL", 91, 82],
  ["XXL", 96, 84],
];
export default function SizeGuide({ open, onClose, category, kind }) {
  const bottom = kind === "bottoms" || ["Trousers", "Jeans"].includes(category);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Size guide"
      className="size-guide-panel"
    >
      <p>
        Illustrative measurements only. These are sample garment dimensions, not
        verified measurements for this product. Please confirm your fit with us
        before ordering.
      </p>
      {kind === "set" && (
        <p>
          This set uses the tops table below. Confirm trouser waist and inseam
          with us before ordering.
        </p>
      )}
      <div className="size-table-wrap">
        <table>
          <caption>
            {bottom ? "Trousers & jeans" : "Tops"} — sample measurements in cm
          </caption>
          <thead>
            <tr>
              {[
                "Size",
                ...(bottom
                  ? ["Waist", "Inseam"]
                  : ["Chest", "Waist", "Length"]),
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(bottom ? bottoms : tops).map((row) => (
              <tr key={row[0]}>
                <th scope="row">{row[0]}</th>
                {row.slice(1).map((value, i) => (
                  <td key={i}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Measure a garment that fits you well, laid flat. Chest and waist values
        above show full circumference; length runs from shoulder to hem, and
        inseam from crotch to hem.
      </p>
    </Drawer>
  );
}
