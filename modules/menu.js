export class Menu {
  constructor() {
    this.onNew = null;
  }
  triggerNew() {
    if (this.onNew) this.onNew();
  }
}
