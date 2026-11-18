import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddressForm from "../checkout/AddressForm";
import Button from "../Button";
import Icon from "../Icon";
import { EMPTY_ADDRESS, validateAddress } from "../../utils/checkout";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
export default function AddressBook({ addresses, save }) {
  const [editing, setEditing] = useState(null),
    [values, setValues] = useState({ ...EMPTY_ADDRESS, label: "" }),
    [errors, setErrors] = useState({});
  const { notify } = useToast(),
    { setAddressFields } = useCart(),
    go = useNavigate();
  function open(address) {
    setValues(address ? { ...address } : { ...EMPTY_ADDRESS, label: "" });
    setErrors({});
    setEditing(address?.id || "new");
  }
  function persist(next, message) {
    const stored = save(next);
    notify(
      stored
        ? message
        : `${message} Available for this visit only because browser storage is unavailable.`,
      stored ? "success" : "info",
    );
  }
  function submit(event) {
    event.preventDefault();
    const next = validateAddress(values);
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`address-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    const address = {
      ...Object.fromEntries(
        Object.keys(EMPTY_ADDRESS).map((key) => [key, values[key].trim()]),
      ),
      label: values.label.trim() || "Address",
      id:
        editing === "new"
          ? globalThis.crypto?.randomUUID?.() ||
            `address-${Date.now()}-${Math.random().toString(36).slice(2)}`
          : editing,
    };
    persist(
      editing === "new"
        ? [...addresses, address]
        : addresses.map((item) => (item.id === editing ? address : item)),
      "Address saved.",
    );
    setEditing(null);
  }
  return (
    <>
      <div className="account-panel-heading">
        <h2>Addresses</h2>
        {editing === null && (
          <Button variant="light" onClick={() => open(null)}>
            <Icon name="plus" />
            Add address
          </Button>
        )}
      </div>
      <p className="muted">
        Saved in this browser for your account. Addresses are not synced to the
        server.
      </p>
      {editing !== null ? (
        <form className="address-book-form" onSubmit={submit} noValidate>
          <label htmlFor="address-label">Address label (optional)</label>
          <input
            id="address-label"
            value={values.label}
            maxLength={40}
            placeholder="Home or work"
            onChange={(e) =>
              setValues((old) => ({ ...old, label: e.target.value }))
            }
          />
          <AddressForm
            title={editing === "new" ? "Add an address" : "Edit address"}
            value={values}
            errors={errors}
            onChange={(name, value) => {
              setValues((old) => ({ ...old, [name]: value }));
              setErrors((old) => ({ ...old, [name]: undefined }));
            }}
            onBlur={(name) =>
              setErrors((old) => ({
                ...old,
                [name]: validateAddress(values)[name],
              }))
            }
          />
          <div className="address-book-actions">
            <Button type="submit">Save address</Button>
            <Button variant="light" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : addresses.length ? (
        <div className="saved-addresses">
          {addresses.map((address) => (
            <article key={address.id} className="saved-address">
              <h3>{address.label}</h3>
              <p>
                <strong>{address.fullName}</strong>
                <br />
                {address.line1}
                {address.line2 && (
                  <>
                    <br />
                    {address.line2}
                  </>
                )}
                <br />
                {address.city}, {address.state} {address.pin}
                <br />
                {address.phone}
              </p>
              <div className="saved-address-actions">
                <button className="text-link" onClick={() => open(address)}>
                  Edit
                </button>
                <button
                  className="text-link"
                  onClick={() =>
                    persist(
                      addresses.filter((item) => item.id !== address.id),
                      "Address removed.",
                    )
                  }
                >
                  Remove
                </button>
                <button
                  className="text-link"
                  onClick={() => {
                    setAddressFields(
                      Object.fromEntries(
                        Object.keys(EMPTY_ADDRESS).map((key) => [
                          key,
                          address[key],
                        ]),
                      ),
                    );
                    go("/cart?step=address#delivery-address");
                  }}
                >
                  Use at checkout <Icon name="arrow" width="16" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="account-empty">
          <Icon name="delivery" width="40" height="40" />
          <h3>
            A home for your next delivery<span className="orange">.</span>
          </h3>
          <p>
            No saved addresses yet. Add one to make your next checkout easier.
          </p>
          <Button onClick={() => open(null)}>Add your first address</Button>
        </div>
      )}
    </>
  );
}
