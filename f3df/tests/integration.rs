use f3df;

#[test]
fn parse_file() {
    let file = std::fs::File::open("tests/files/boxes.f3d").unwrap();
    f3df::parse_sector(file).unwrap();
    // TODO verify contents of file
}
