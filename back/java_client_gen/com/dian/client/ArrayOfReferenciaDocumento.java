
package com.dian.client;

import java.util.ArrayList;
import java.util.List;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for ArrayOfReferenciaDocumento complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="ArrayOfReferenciaDocumento">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="ReferenciaDocumento" type="{http://schemas.datacontract.org/2004/07/ReferenciaDocumento}ReferenciaDocumento" maxOccurs="unbounded" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "ArrayOfReferenciaDocumento", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", propOrder = {
    "referenciaDocumento"
})
public class ArrayOfReferenciaDocumento {

    @XmlElement(name = "ReferenciaDocumento", nillable = true)
    protected List<ReferenciaDocumento> referenciaDocumento;

    /**
     * Gets the value of the referenciaDocumento property.
     * 
     * <p>
     * This accessor method returns a reference to the live list,
     * not a snapshot. Therefore any modification you make to the
     * returned list will be present inside the JAXB object.
     * This is why there is not a <CODE>set</CODE> method for the referenciaDocumento property.
     * 
     * <p>
     * For example, to add a new item, do as follows:
     * <pre>
     *    getReferenciaDocumento().add(newItem);
     * </pre>
     * 
     * 
     * <p>
     * Objects of the following type(s) are allowed in the list
     * {@link ReferenciaDocumento }
     * 
     * 
     */
    public List<ReferenciaDocumento> getReferenciaDocumento() {
        if (referenciaDocumento == null) {
            referenciaDocumento = new ArrayList<ReferenciaDocumento>();
        }
        return this.referenciaDocumento;
    }

}
