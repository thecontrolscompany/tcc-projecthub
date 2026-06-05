# GGT Symbol Cleanup Notes

- `vfd_panel` is a composite drive/panel glyph. The XAML templates expose VFD behavior through control widgets rather than a single dedicated symbol class.
- `pressure_sensor` is generic by design. The GGT templates split pressure semantics across air and water families, so some future cleanup may be needed to separate discharge, deck, and differential pressure more precisely.
- `controller_panel` is also composite. It is derived from `StaticRoomControlModule`, `KeyDataWidget`, and N2 controller templates, so the final visual language may need tightening once the renderer is wired to live estimator state.
- The remaining symbols are directly reusable as compact SVG icons and should need only minor sizing or stroke normalization if the renderer moves to a denser layout.
