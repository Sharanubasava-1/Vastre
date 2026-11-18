import Icon from "../Icon";
import { DELIVERY_COPY } from "../../config/storefront";

export default function DeliveryNote() {
  return (
    <p className="delivery-note">
      <Icon name="delivery" />
      {DELIVERY_COPY}
    </p>
  );
}
