/// This class represents a vector of objects wrapped
/// inside of a hot potato struct.
module pyth::authenticated_price_infos {
    use std::vector;

    friend pyth::pyth;

    // A vector of elements
    struct AuthenticatedPriceInfos<T: copy + drop> has drop {
        contents: vector<T>
    }

    // A public destroy function.
    public fun destroy<T: copy + drop>(vec: AuthenticatedPriceInfos<T>){
        let AuthenticatedPriceInfos {contents: _} = vec;
    }

    // Only certain on-chain functions are allowed to create a new hot potato vector.
    public(friend) fun new<T: copy + drop>(vec: vector<T>): AuthenticatedPriceInfos<T>{
        AuthenticatedPriceInfos {
            contents: vec
        }
    }

    public fun length<T: copy + drop>(vec: &AuthenticatedPriceInfos<T>): u64 {
        vector::length(&vec.contents)
    }

    public fun is_empty<T: copy + drop>(vec: &AuthenticatedPriceInfos<T>): bool {
        vector::is_empty(&vec.contents)
    }

    public fun borrow<T: copy + drop>(vec: &AuthenticatedPriceInfos<T>, i: u64): &T {
        vector::borrow<T>(&vec.contents, i)
    }

    public(friend) fun pop_back<T: copy + drop>(vec: AuthenticatedPriceInfos<T>): (T, AuthenticatedPriceInfos<T>){
        let elem = vector::pop_back<T>(&mut vec.contents);
        return (elem, vec)
    }

    #[test_only]
    struct A has copy, drop {
        a : u64
    }

    #[test]
    fun test_authenticated_price_infos(){
        let vec_of_a = vector::empty<A>();
        vector::push_back(&mut vec_of_a, A{a:5});
        vector::push_back(&mut vec_of_a, A{a:11});
        vector::push_back(&mut vec_of_a, A{a:23});

        let vec = new<A>(vec_of_a);
        let (b, vec) = pop_back<A>(vec);
        assert!(b.a==23, 0);
        (b, vec) = pop_back<A>(vec);
        assert!(b.a==11, 0);
        let (b, vec) = pop_back<A>(vec);
        assert!(b.a==5, 0);

        destroy<A>(vec);
    }
}
