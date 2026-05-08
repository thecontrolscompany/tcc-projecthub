export const sideloopTree = {
  id: "sideloop",
  label: "Sideloop",
  abbr: "SDL",
  color: "#0891B2",
  description: "Sideloop heat exchanger with pumps and isolation valves.",
  systemType: "sideloop",
  configurations: [{ id: "standard", label: "Sideloop" }],
  mechanicalTree: [
    {
      id: "sideloop-mechanical-root-2",
      label: "Sideloop",
      scope: "mechanical",
      required: false,
      items: [],
    },
    {
      id: "sideloop-feedback-control-10",
      label: "Feedback Control",
      scope: "control",
      required: false,
      items: [
        {
          id: "sideloop-feedback-input-type-11",
          label: "Input Type",
          type: "radio",
          defaultOption: "temperature-12",
          options: [
            { id: "temperature-12", label: "Temperature" },
            { id: "humidity-15", label: "Humidity" },
            { id: "other-16", label: "Other" },
          ],
        },
        {
          id: "sideloop-feedback-control-type-30",
          label: "Control Type",
          type: "radio",
          defaultOption: "feedback-control-pi-32",
          options: [
            { id: "simple-reset-span-31", label: "Simple Reset (SPAN)" },
            { id: "feedback-control-pi-32", label: "Feedback Control (PI)" },
          ],
        },
        {
          id: "sideloop-feedback-output-type-45",
          label: "Output Type",
          type: "radio",
          defaultOption: "proportional-actuator-46",
          options: [
            { id: "proportional-actuator-46", label: "Proportional Actuator" },
            { id: "incremental-actuator-47", label: "Incremental Actuator" },
            { id: "staged-outputs-50", label: "Staged Outputs" },
          ],
        },
      ],
    },
    {
      id: "sideloop-analog-to-binary-control-110",
      label: "Analog to Binary Control",
      scope: "control",
      required: false,
      items: [
        {
          id: "sideloop-analog-binary-input-type-111",
          label: "Input Type",
          type: "radio",
          defaultOption: "temperature-112",
          options: [
            { id: "temperature-112", label: "Temperature" },
            { id: "humidity-115", label: "Humidity" },
            { id: "other-116", label: "Other" },
          ],
        },
        {
          id: "sideloop-analog-binary-control-action-140",
          label: "Control Action",
          type: "radio",
          defaultOption: "reverse-acting-141",
          options: [
            { id: "reverse-acting-141", label: "Reverse Acting" },
            { id: "direct-acting-142", label: "Direct Acting" },
          ],
        },
      ],
    },
    {
      id: "sideloop-binary-interlock-control-60",
      label: "Binary Interlock Control",
      scope: "control",
      required: false,
      items: [
        { id: "sideloop-use-existing-bi-64", label: "Use Existing BI (Manually Connect)", type: "check", defaultChecked: false },
        {
          id: "sideloop-binary-output-type-61",
          label: "Output Type",
          type: "radio",
          defaultOption: "binary-output-62",
          options: [
            { id: "binary-output-62", label: "Binary Output" },
            { id: "analog-output-63", label: "Analog Output" },
          ],
        },
      ],
    },
    {
      id: "sideloop-create-state-selection-101",
      label: "Create State Selection to Interlock this Side Loop",
      scope: "control",
      required: false,
      items: [
        { id: "sideloop-create-state-selection-101", label: "Create State Selection to Interlock this Side Loop", type: "check", defaultChecked: false },
        { id: "sideloop-create-new-input-for-interlock-102", label: "Create New Input for Interlock", type: "check", defaultChecked: false, showWhen: { itemId: "sideloop-create-state-selection-101", value: true } },
      ],
    },
    {
      id: "sideloop-position-feedback-201",
      label: "Position Feedback",
      scope: "optional-hardware",
      required: false,
      items: [
        {
          id: "sideloop-modulated-outputs-210",
          label: "Modulated Outputs",
          type: "radio",
          defaultOption: "no-position-feedback-211",
          options: [
            { id: "no-position-feedback-211", label: "No Position Feedback" },
            { id: "analog-input-per-output-212", label: "Analog Input per Output" },
            { id: "binary-input-per-output-213", label: "Binary Input per Output" },
          ],
        },
        {
          id: "sideloop-two-position-outputs-240",
          label: "Two Position Outputs",
          type: "radio",
          defaultOption: "no-position-feedback-241",
          options: [
            { id: "no-position-feedback-241", label: "No Position Feedback" },
            { id: "binary-input-per-output-242", label: "Binary Input per Output" },
            { id: "two-binary-inputs-per-output-243", label: "Two Binary Inputs per Output" },
          ],
        },
      ],
    },
  ],
};
