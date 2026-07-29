import type { Meta, StoryObj } from "@storybook/react-vite";
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator, MenuGroup, MenuGroupLabel } from "./Menu";
import { Button } from "./Button";

const meta = {
  title: "Primitives/Menu",
  component: Menu,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Menu items are the only control in the design with a drawn hover state.
 * Styling targets `data-highlighted`, not `:hover`, so keyboard users get the
 * same indication of where they are — `:hover` alone would leave them blind to
 * their own position.
 */
export const AccountMenu: Story = {
  args: { children: null },
  render: () => (
    <Menu>
      <MenuTrigger render={<Button fill="outlined" tone="neutral">R. Delacroix</Button>} />
      <MenuPopup>
        <MenuGroup>
          <MenuGroupLabel>Account</MenuGroupLabel>
          <MenuItem>Profile</MenuItem>
          <MenuItem>People</MenuItem>
          <MenuItem>Clients</MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>Record</MenuGroupLabel>
          <MenuItem>Audit</MenuItem>
          <MenuItem>Rulebook</MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem tone="halt">Sign out</MenuItem>
      </MenuPopup>
    </Menu>
  ),
};
