const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const ICON_SIZE = 28;


class MediaPlayerMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(name) {
        super({});
        let result = name.match(/^org\.mpris\.MediaPlayer2\.(.+)/);
        let app_name = result[1];

        let appsys = Cinnamon.AppSystem.get_default();
        let app = appsys.lookup_app(`${app_name}.desktop`);
        this.activate = this.emit.bind(this, 'change-player', name);

        this.addActor(app.create_icon_texture(ICON_SIZE), { expand: false, span: 0 });
        this.addActor(new St.Label({ text: app.get_name() }));
    }
}