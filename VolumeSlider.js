const Clutter = imports.gi.Clutter;
const Cvc = imports.gi.Cvc;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const {LogUtils} = require(`./LogUtils`)
const LOG = new LogUtils();
var VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */


class VolumeSlider extends PopupMenu.PopupSliderMenuItem {
	constructor(magneticOn, tooltip, app_icon, direction) {
			super(0);
			this.magneticOn = magneticOn;
			this.direction = direction;

			this.setTooltipText(tooltip);


			this.icon = new St.Icon({icon_name: app_icon, icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon'});

			this.removeActor(this._slider);
			this.addActor(this.icon, {span: 0});
			this.addActor(this._slider, {span: -1, expand: true});
	}

	setTooltipText(text){
		if(!this.tooltip) {
			this.tooltip = new Tooltips.Tooltip(this.actor, "");
			this.tooltipText = (text) ?
				`${text}: `:
				""
			;
		}
		this.tooltip.set_text(`${this.tooltipText}${text}`);
	}

    _motionEvent(actor, event) {
		super._motionEvent(actor, event);
		this.emit('volume-slide', this.value);
        return true;
    }	
	
	_changeValue(step) {
		let value = this.value + step;
		value = (step < 0) ?
			Math.max(0, value):
			Math.min(1, value)
		;
		this._slider.queue_repaint();
		this.setValue(value);
		this.emit('volume-slide', value);
	}

	_onScrollEvent(actor, event) {
		const direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return Clutter.EVENT_PROPAGATE;
        }

		let step = 
			(direction == Clutter.ScrollDirection.UP) ?
			VOLUME_ADJUSTMENT_STEP:
			-VOLUME_ADJUSTMENT_STEP
		;
		this._changeValue(step);
	}

	_onKeyPressEvent(actor, event) {
		let key = event.get_key_symbol();
		let step = VOLUME_ADJUSTMENT_STEP/2;
		switch(key) {
			case Clutter.KEY_Left:
			case Clutter.KEY_AudioLowerVolume:
				step = -step;
			case Clutter.KEY_Right:
			case Clutter.KEY_AudioRaiseVolume:
				break;

			default:
				return false;
		}
		this._changeValue(step);
		// this.emit('drag-end');
		return true;
	}
	
	update(controller, value, mark) {
		this.set_mark(mark);
		let percentage = Math.round(value / mark * 100) + "%";
		this.setTooltipText(percentage);

		if (this._dragging) {
			this.tooltip.show();
		}
		this.setValue(value);
	}
}
module.exports = {VolumeSlider}