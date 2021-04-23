/**
 * Unit testing
 * 
 * index.test.js
 * @author jesse a thompson
 * 
 * Run:
 * npm test index
 * 
 * toStrictEqual
 * toBe
 * not
 */


test("Sample (success)", async () => {
    let a = 2 + 3;
    expect(a).toBe(5);
});

test("Sample (fail)", async () => {
    let a = 2 + 3;
    expect(a).not.toBe(100);
});