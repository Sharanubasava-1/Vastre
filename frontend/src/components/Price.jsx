import { money } from "../utils/store";
export default function Price({ amount }) {
  return money(amount);
}
