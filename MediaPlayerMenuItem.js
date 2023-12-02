const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const ICON_SIZE = 28;


class MediaPlayerMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(name, owner) {
        super({});
        this._owner = owner;
        let appsys = Cinnamon.AppSystem.get_default();
        let app = appsys.lookup_app(`${name}.desktop`);
        this.activate = this.emit.bind(this, 'change-player', this._owner);

        this.addActor(app.create_icon_texture(ICON_SIZE), { expand: false, span: 0 });
        this.addActor(new St.Label({ text: app.get_name() }));
    }
}