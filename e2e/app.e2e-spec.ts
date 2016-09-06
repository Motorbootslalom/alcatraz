import { AlcatrazPage } from './app.po';

describe('alcatraz App', function() {
  let page: AlcatrazPage;

  beforeEach(() => {
    page = new AlcatrazPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
